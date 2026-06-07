import { prisma } from './db';
import { stripe } from './stripe';
import { publishPaymentCreated } from './kafka';

let timer: ReturnType<typeof setInterval> | null = null;

async function runPayoutCycle() {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'funded' },
      include: { creator: { include: { stripeAccount: true } } },
    });

    for (const campaign of campaigns) {
      const acct = campaign.creator.stripeAccount;
      if (!acct?.chargesEnabled) continue;

      const transfer = await stripe.transfers.create({
        amount: campaign.raisedAmount,
        currency: 'usd',
        destination: acct.stripeAccountId,
        transfer_group: campaign.id,
      });

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'paid_out' },
      });

      await publishPaymentCreated({
        id: transfer.id,
        recipientId: campaign.creatorId,
        senderId: 'platform',
        amount: campaign.raisedAmount,
        currency: 'usd',
        status: 'completed',
        createdAt: new Date().toISOString(),
      });

      console.log(`[scheduler] Paid out campaign ${campaign.id} → ${acct.stripeAccountId}`);
    }
  } catch (err) {
    console.error('[scheduler] Payout cycle error:', err);
  }
}

export function startScheduler() {
  timer = setInterval(runPayoutCycle, 60_000);
  console.log('[scheduler] Auto-payout scheduler started');
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
