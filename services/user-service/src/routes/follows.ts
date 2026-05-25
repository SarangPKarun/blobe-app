import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export default async function (fastify: FastifyInstance) {
  fastify.post(
    '/:id/follow',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { id: followingId } = request.params as { id: string };
      const followerId = request.user.id;

      if (followerId === followingId) {
        return reply.code(400).send({ error: 'Cannot follow yourself' });
      }

      // Check if user to follow exists
      const targetUser = await prisma.user.findUnique({ where: { id: followingId } });
      if (!targetUser) {
        return reply.code(404).send({ error: 'User not found' });
      }

      try {
        await prisma.follows.create({
          data: {
            followerId,
            followingId,
          },
        });
        return reply.code(201).send({ message: 'Successfully followed user' });
      } catch (error: any) {
        if (error.code === 'P2002') {
          return reply.code(409).send({ error: 'Already following user' });
        }
        throw error;
      }
    }
  );

  fastify.delete(
    '/:id/follow',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { id: followingId } = request.params as { id: string };
      const followerId = request.user.id;

      try {
        await prisma.follows.delete({
          where: {
            followerId_followingId: {
              followerId,
              followingId,
            },
          },
        });
        return reply.code(204).send();
      } catch (error: any) {
        if (error.code === 'P2025') {
          return reply.code(404).send({ error: 'Follow relationship not found' });
        }
        throw error;
      }
    }
  );
}
