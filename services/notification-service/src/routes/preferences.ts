import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export default async function (fastify: FastifyInstance) {
  // PATCH /users/:id/notification-prefs
  fastify.patch(
    '/:id/notification-prefs',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          pushEnabled: z.boolean().optional(),
          emailEnabled: z.boolean().optional(),
          postCreated: z.boolean().optional(),
          trustVote: z.boolean().optional(),
          payment: z.boolean().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        pushEnabled?: boolean;
        emailEnabled?: boolean;
        postCreated?: boolean;
        trustVote?: boolean;
        payment?: boolean;
      };

      if (request.user.id !== id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const prefs = await prisma.notificationPreference.upsert({
        where: { userId: id },
        create: { userId: id, ...body },
        update: body,
      });

      return reply.send(prefs);
    }
  );
}
