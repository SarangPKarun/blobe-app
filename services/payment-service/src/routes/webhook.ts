import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { prisma } from '../services/db';
import { stripe } from '../services/stripe';
import { publishPaymentCreated } from '../services/kafka';

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/stripe/webhook',
    { config: { rawBody: true } },
    async (request, reply) => {
      const sig = request.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          request.rawBody as Buffer,
          sig,
          webhookSecret || ''
        );
      } catch (err: any) {
        return reply.code(400).send({ error: `Webhook signature verification failed: ${err.message}` });
      }

      try {
        switch (event.type) {
          case 'payment_intent.succeeded':
            await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
            break;
          case 'payment_intent.payment_failed':
            await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
            break;
          case 'account.updated':
            await handleAccountUpdated(event.data.object as Stripe.Account);
            break;
        }
      } catch (err) {
        console.error(`[webhook] handler error for ${event.type}:`, err);
        return reply.code(500).send({ error: 'Handler error' });
      }

      return reply.code(200).send({ received: true });
    }
  );
}

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: pi.id },
  });
  if (!payment) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'completed' },
  });

  if (payment.type === 'donation' && payment.campaignId) {
    const campaign = await prisma.campaign.update({
      where: { id: payment.campaignId },
      data: { raisedAmount: { increment: payment.amount } },
    });
    if (campaign.raisedAmount >= campaign.goalAmount && campaign.status === 'active') {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'funded' },
      });
    }
  } else if (payment.type === 'ad_bid') {
    await handleAdBidSucceeded(pi, payment.id);
  }

  await publishPaymentCreated({
    id: payment.id,
    recipientId: payment.recipientId,
    senderId: payment.senderId,
    amount: payment.amount,
    currency: payment.currency,
    status: 'completed',
    createdAt: new Date().toISOString(),
  });
}

async function handleAdBidSucceeded(pi: Stripe.PaymentIntent, paymentId: string) {
  const bidId = pi.metadata?.bidId;
  if (!bidId) return;

  const bid = await prisma.adBid.update({
    where: { id: bidId },
    data: { status: 'won' },
  });

  // Capture the held authorization
  await stripe.paymentIntents.capture(pi.id).catch(() => {});

  // Activate or create a Banner for this slot
  if (bid.bannerId) {
    await prisma.banner.update({
      where: { id: bid.bannerId },
      data: { isActive: true, activeFrom: bid.startTime, activeTo: bid.endTime, ownerId: bid.userId },
    });
  } else {
    const banner = await prisma.banner.create({
      data: {
        imageUrl: bid.imageUrl,
        linkUrl: bid.linkUrl,
        isActive: true,
        activeFrom: bid.startTime,
        activeTo: bid.endTime,
        ownerId: bid.userId,
      },
    });
    await prisma.adBid.update({ where: { id: bid.id }, data: { bannerId: banner.id } });
  }

  // Cancel losing bids that overlap this slot
  const losingBids = await prisma.adBid.findMany({
    where: {
      id: { not: bid.id },
      status: 'pending',
      startTime: { lt: bid.endTime },
      endTime: { gt: bid.startTime },
    },
  });
  for (const losing of losingBids) {
    await prisma.adBid.update({ where: { id: losing.id }, data: { status: 'lost' } });
    if (losing.stripePaymentIntentId) {
      await stripe.paymentIntents.cancel(losing.stripePaymentIntentId).catch(() => {});
    }
  }
}

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: pi.id },
  });
  if (!payment) return;

  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });

  if (payment.type === 'ad_bid') {
    const bidId = pi.metadata?.bidId;
    if (bidId) {
      await prisma.adBid.update({ where: { id: bidId }, data: { status: 'lost' } });
    }
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  await prisma.stripeAccount.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    },
  });
}
