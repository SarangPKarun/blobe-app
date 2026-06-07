import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { stripe } from '../services/stripe';

const AdBidBody = z.object({
  amount: z.number().int().min(100), // minimum $1
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  imageUrl: z.string().url(),
  linkUrl: z.string().url().optional(),
});

export default async function (fastify: FastifyInstance) {
  // Place a bid for a globe banner slot
  fastify.post(
    '/ads/bids',
    {
      preValidation: [fastify.authenticate],
      schema: { body: AdBidBody },
    },
    async (request, reply) => {
      const { amount, startTime, endTime, imageUrl, linkUrl } = request.body as z.infer<typeof AdBidBody>;
      const userId = request.user.id;
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        return reply.code(400).send({ error: 'endTime must be after startTime' });
      }

      // Find highest competing bid for overlapping slot
      const competing = await prisma.adBid.findFirst({
        where: {
          status: { in: ['pending', 'won'] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
        orderBy: { amount: 'desc' },
      });

      if (competing && amount <= competing.amount) {
        return reply.code(409).send({
          error: 'Bid too low',
          currentHighest: competing.amount,
        });
      }

      const bid = await prisma.adBid.create({
        data: { userId, amount, startTime: start, endTime: end, imageUrl, linkUrl },
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        capture_method: 'manual', // only capture when bid wins
        metadata: { bidId: bid.id, type: 'ad_bid' },
      });

      const updatedBid = await prisma.adBid.update({
        where: { id: bid.id },
        data: { stripePaymentIntentId: paymentIntent.id },
      });

      // Mark the displaced bid as lost and cancel its PaymentIntent
      if (competing) {
        await prisma.adBid.update({ where: { id: competing.id }, data: { status: 'lost' } });
        if (competing.stripePaymentIntentId) {
          await stripe.paymentIntents.cancel(competing.stripePaymentIntentId).catch(() => {});
        }
      }

      return reply.code(201).send({ bidId: updatedBid.id, clientSecret: paymentIntent.client_secret });
    }
  );

  // Get currently active banner bid
  fastify.get(
    '/ads/bids/current',
    { preValidation: [fastify.authenticate] },
    async (_request, reply) => {
      const now = new Date();
      const activeBid = await prisma.adBid.findFirst({
        where: { status: 'active', startTime: { lte: now }, endTime: { gt: now } },
        include: { user: { select: { id: true, username: true } } },
      });
      return activeBid ?? reply.code(204).send();
    }
  );
}
