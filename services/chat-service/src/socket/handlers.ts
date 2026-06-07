import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db';
import { setUserOnline, setUserOffline, refreshPresence } from '../services/redis';
import { publishChatMessage } from '../services/kafka';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

export function registerSocketHandlers(io: Server): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
      ) as { id: string };
      (socket as AuthenticatedSocket).userId = payload.id;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId } = socket;

    await setUserOnline(userId, socket.id);

    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const roomIds = participations.map((p) => p.conversationId);
    socket.join(roomIds);

    socket.to(roomIds).emit('presence:update', { userId, online: true });

    const heartbeat = setInterval(() => refreshPresence(userId), 30_000);

    socket.on('conversation:join', async (conversationId: string) => {
      const participant = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      });
      if (participant) socket.join(conversationId);
    });

    socket.on(
      'message:send',
      async (
        data: { conversationId: string; encryptedContent: string; iv: string },
        ack?: (result: { messageId: string; createdAt: string } | { error: string }) => void,
      ) => {
        try {
          const participant = await prisma.conversationParticipant.findUnique({
            where: { conversationId_userId: { conversationId: data.conversationId, userId } },
          });
          if (!participant) {
            ack?.({ error: 'Not a participant' });
            return;
          }

          const message = await prisma.chatMessage.create({
            data: {
              conversationId: data.conversationId,
              senderId: userId,
              encryptedContent: data.encryptedContent,
              iv: data.iv,
            },
          });

          await prisma.conversation.update({
            where: { id: data.conversationId },
            data: { updatedAt: new Date() },
          });

          io.to(data.conversationId).emit('message:new', {
            id: message.id,
            conversationId: message.conversationId,
            senderId: message.senderId,
            encryptedContent: message.encryptedContent,
            iv: message.iv,
            createdAt: message.createdAt.toISOString(),
            isDeleted: false,
          });

          ack?.({ messageId: message.id, createdAt: message.createdAt.toISOString() });

          const allParticipants = await prisma.conversationParticipant.findMany({
            where: { conversationId: data.conversationId },
            select: { userId: true },
          });
          const recipientIds = allParticipants.map((p) => p.userId).filter((id) => id !== userId);

          await publishChatMessage({
            messageId: message.id,
            conversationId: data.conversationId,
            senderId: userId,
            recipientIds,
            createdAt: message.createdAt.toISOString(),
          });
        } catch (err) {
          console.error('[socket] message:send error:', err);
          ack?.({ error: 'Failed to send message' });
        }
      },
    );

    socket.on('typing:start', (conversationId: string) => {
      socket.to(conversationId).emit('typing:start', { userId, conversationId });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(conversationId).emit('typing:stop', { userId, conversationId });
    });

    socket.on('message:read', async (data: { conversationId: string; messageId: string }) => {
      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: data.conversationId, userId } },
        data: { lastReadAt: new Date() },
      });
      socket.to(data.conversationId).emit('message:read', {
        userId,
        conversationId: data.conversationId,
        messageId: data.messageId,
      });
    });

    socket.on('disconnect', async () => {
      clearInterval(heartbeat);
      await setUserOffline(userId);
      socket.to(roomIds).emit('presence:update', { userId, online: false });
    });
  });
}
