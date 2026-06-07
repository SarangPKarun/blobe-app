import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { stripe } from '../services/stripe';

export default async function (fastify: FastifyInstance) {
  // Start or resume Stripe Connect onboarding for a journalist account
  fastify.post(
    '/connect/onboard',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user.id;

      let stripeAccountId: string;

      const existing = await prisma.stripeAccount.findUnique({ where: { userId } });
      if (existing) {
        stripeAccountId = existing.stripeAccountId;
      } else {
        const account = await stripe.accounts.create({ type: 'express' });
        stripeAccountId = account.id;
        await prisma.stripeAccount.create({
          data: { userId, stripeAccountId },
        });
      }

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: process.env.STRIPE_CONNECT_REFRESH_URL || 'blobe://connect/refresh',
        return_url: process.env.STRIPE_CONNECT_RETURN_URL || 'blobe://connect/return',
        type: 'account_onboarding',
      });

      return reply.code(200).send({ url: accountLink.url });
    }
  );

  // Get Stripe Connect account status
  fastify.get(
    '/connect/status',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user.id;
      const account = await prisma.stripeAccount.findUnique({ where: { userId } });
      if (!account) {
        return reply.code(404).send({ error: 'No Stripe Connect account found' });
      }
      return account;
    }
  );
}
