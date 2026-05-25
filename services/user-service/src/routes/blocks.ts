import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { blockUser, unblockUser, getBlockedUsers } from '../services/redis';
import { prisma } from '../services/db';

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/:id/block',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { id: blockedUserId } = request.params as { id: string };
      const userId = request.user.id;

      if (userId === blockedUserId) {
        return reply.code(400).send({ error: 'Cannot block yourself' });
      }

      // Ensure user to block exists
      const targetUser = await prisma.user.findUnique({ where: { id: blockedUserId } });
      if (!targetUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      await blockUser(userId, blockedUserId);

      // Optionally, we could also remove follows if they exist
      try {
        await prisma.follows.deleteMany({
          where: {
            OR: [
              { followerId: userId, followingId: blockedUserId },
              { followerId: blockedUserId, followingId: userId },
            ],
          },
        });
      } catch (e) {
        // Ignore if no follow relationship exists
      }

      return reply.code(201).send({ message: 'User blocked successfully' });
    }
  );

  fastify.delete(
    '/:id/block',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { id: blockedUserId } = request.params as { id: string };
      const userId = request.user.id;

      await unblockUser(userId, blockedUserId);

      return reply.code(204).send();
    }
  );

  fastify.get(
    '/blocks',
    {
      preValidation: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const blockedUsers = await getBlockedUsers(userId);
      return { blockedUsers };
    }
  );
}
