import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export default async function keyRoutes(fastify: FastifyInstance) {
  // POST /keys — register or update the authed user's public key
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        body: z.object({ publicKey: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const { publicKey } = request.body as { publicKey: string };
      const userId = (request.user as { id: string }).id;

      const record = await prisma.userPublicKey.upsert({
        where: { userId },
        create: { userId, publicKey },
        update: { publicKey },
      });

      return reply.code(200).send({ userId: record.userId, publicKey: record.publicKey });
    },
  );

  // GET /keys/:userId — fetch a user's public key (needed before first message)
  fastify.get(
    '/:userId',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ userId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };

      const record = await prisma.userPublicKey.findUnique({ where: { userId } });
      if (!record) return reply.code(404).send({ error: 'Public key not found' });

      return reply.send({ userId: record.userId, publicKey: record.publicKey });
    },
  );
}
