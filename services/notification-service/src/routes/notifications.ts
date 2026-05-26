import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export default async function (fastify: FastifyInstance) {
  // GET /notifications — paginated list for authenticated user
  fastify.get(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(100).default(20),
          cursor: z.string().uuid().optional(),
          unreadOnly: z.coerce.boolean().default(false),
        }),
      },
    },
    async (request, reply) => {
      const { limit, cursor, unreadOnly } = request.query as {
        limit: number;
        cursor?: string;
        unreadOnly: boolean;
      };
      const userId = request.user.id;

      let cursorDate: Date | undefined;
      if (cursor) {
        const cursorRecord = await prisma.notification.findUnique({
          where: { id: cursor },
          select: { createdAt: true },
        });
        if (cursorRecord) {
          cursorDate = cursorRecord.createdAt;
        }
      }

      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          ...(unreadOnly && { isRead: false }),
          ...(cursorDate && { createdAt: { lt: cursorDate } }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = notifications.length > limit;
      const page = notifications.slice(0, limit);

      return reply.send({
        notifications: page,
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].id : null,
      });
    }
  );

  // PATCH /notifications/read-all
  fastify.patch(
    '/read-all',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const userId = request.user.id;
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return reply.send({ success: true });
    }
  );

  // PATCH /notifications/:id/read
  fastify.patch(
    '/:id/read',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user.id;

      try {
        const notification = await prisma.notification.update({
          where: { id, userId },
          data: { isRead: true },
        });
        return reply.send(notification);
      } catch (error: any) {
        if (error.code === 'P2025') {
          return reply.code(404).send({ error: 'Notification not found' });
        }
        throw error;
      }
    }
  );
}
