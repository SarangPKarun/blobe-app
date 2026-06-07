import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/users/:id/earnings',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (request.user.id !== id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const payments = await prisma.payment.findMany({
        where: { recipientId: id, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          amount: true,
          currency: true,
          type: true,
          stripeTransferId: true,
          campaignId: true,
        },
      });

      const total = payments.reduce((sum, p) => sum + p.amount, 0);

      // Group by year-month
      const byMonth: Record<string, number> = {};
      for (const p of payments) {
        const key = p.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
        byMonth[key] = (byMonth[key] ?? 0) + p.amount;
      }

      return { total, currency: 'usd', byMonth, payments };
    }
  );
}
