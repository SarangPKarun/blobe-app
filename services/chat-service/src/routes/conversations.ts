import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export default async function conversationRoutes(fastify: FastifyInstance) {
  // POST /conversations — create or find existing DM
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        body: z.object({ recipientId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { recipientId } = request.body as { recipientId: string };
      const userId = (request.user as { id: string }).id;

      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'dm',
          AND: [
            { participants: { some: { userId } } },
            { participants: { some: { userId: recipientId } } },
          ],
        },
        include: { participants: { select: { userId: true, lastReadAt: true } } },
      });

      if (existing) return reply.send(existing);

      const conversation = await prisma.conversation.create({
        data: {
          type: 'dm',
          participants: {
            create: [{ userId }, { userId: recipientId }],
          },
        },
        include: { participants: { select: { userId: true, lastReadAt: true } } },
      });

      return reply.code(201).send(conversation);
    },
  );

  // GET /conversations — list user's conversations
  fastify.get(
    '/',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const userId = (request.user as { id: string }).id;

      const participations = await prisma.conversationParticipant.findMany({
        where: { userId },
        include: {
          conversation: {
            include: {
              participants: { select: { userId: true, lastReadAt: true } },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { conversation: { updatedAt: 'desc' } },
      });

      const conversations = await Promise.all(
        participations.map(async (p) => {
          const { conversation, lastReadAt } = p;
          const lastMessage = conversation.messages[0] ?? null;
          const unreadCount = lastReadAt
            ? await prisma.chatMessage
                .count({
                  where: {
                    conversationId: conversation.id,
                    createdAt: { gt: lastReadAt },
                    senderId: { not: userId },
                  },
                })
                .catch(() => 0)
            : 0;

          return {
            id: conversation.id,
            type: conversation.type,
            updatedAt: conversation.updatedAt,
            participants: conversation.participants,
            lastMessage,
            unreadCount,
          };
        }),
      );

      return reply.send(conversations);
    },
  );

  // GET /conversations/:id/messages — cursor-paginated history
  fastify.get(
    '/:id/messages',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({
          limit: z.coerce.number().min(1).max(100).default(30),
          cursor: z.string().datetime().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id: conversationId } = request.params as { id: string };
      const { limit, cursor } = request.query as { limit: number; cursor?: string };
      const userId = (request.user as { id: string }).id;

      const participant = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      });
      if (!participant) return reply.code(403).send({ error: 'Not a participant' });

      const messages = await prisma.chatMessage.findMany({
        where: {
          conversationId,
          isDeleted: false,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = messages.length > limit;
      const page = hasMore ? messages.slice(0, limit) : messages;

      return reply.send({
        messages: page,
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
      });
    },
  );
}
