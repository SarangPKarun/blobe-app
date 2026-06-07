import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { stripe } from '../services/stripe';

const DonationBody = z.object({
  campaignId: z.string().uuid(),
  amount: z.number().int().min(50), // minimum 50 cents
});

export default async function (fastify: FastifyInstance) {
  // Create a donation PaymentIntent for a campaign
  fastify.post(
    '/donations',
    {
      preValidation: [fastify.authenticate],
      schema: { body: DonationBody },
    },
    async (request, reply) => {
      const { campaignId, amount } = request.body as z.infer<typeof DonationBody>;
      const senderId = request.user.id;

      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });
      if (campaign.status !== 'active') {
        return reply.code(409).send({ error: 'Campaign is no longer accepting donations' });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        metadata: { campaignId, senderId, type: 'donation' },
      });

      await prisma.payment.create({
        data: {
          senderId,
          recipientId: campaign.creatorId,
          amount,
          currency: 'usd',
          type: 'donation',
          status: 'pending',
          stripePaymentIntentId: paymentIntent.id,
          campaignId,
        },
      });

      return reply.code(201).send({ clientSecret: paymentIntent.client_secret });
    }
  );
}
