import { PostCreatedPayload, TrustVoteCreatedPayload, PaymentCreatedPayload, ChatMessagePayload } from '@blobe/shared-types';
import Redis from 'ioredis';
import { prisma } from './db';
import { sendPushToUser } from './push';
import { sendEmailDigest } from './email';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CHUNK = 100;

async function getPrefs(userId: string) {
  return prisma.notificationPreference.findUnique({ where: { userId } });
}

export async function handlePostCreated(payload: PostCreatedPayload): Promise<void> {
  const [followers, author] = await Promise.all([
    prisma.follows.findMany({
      where: { followingId: payload.authorId },
      select: { followerId: true },
    }),
    prisma.user.findUnique({
      where: { id: payload.authorId },
      select: { username: true },
    }),
  ]);

  if (followers.length === 0) return;

  const username = author?.username ?? 'Someone';
  const content = `@${username} posted a new blob`;
  const title = 'New Post';

  for (let i = 0; i < followers.length; i += CHUNK) {
    const chunk = followers.slice(i, i + CHUNK);

    await Promise.all(
      chunk.map(async ({ followerId }) => {
        const prefs = await getPrefs(followerId);
        if (prefs && !prefs.postCreated) return;

        await prisma.notification.create({
          data: {
            userId: followerId,
            type: 'post_created',
            content,
            sourceId: payload.id,
            actorId: payload.authorId,
          },
        });

        await sendPushToUser(followerId, title, content, { postId: payload.id });
      })
    );
  }
}

export async function handleTrustVote(payload: TrustVoteCreatedPayload): Promise<void> {
  if (payload.postAuthorId === payload.voterId) return;

  const prefs = await getPrefs(payload.postAuthorId);
  if (prefs && !prefs.trustVote) return;

  const content = 'Someone voted on your post';

  await prisma.notification.create({
    data: {
      userId: payload.postAuthorId,
      type: 'trust_vote',
      content,
      sourceId: payload.postId,
      actorId: payload.voterId,
    },
  });

  await sendPushToUser(payload.postAuthorId, 'New Vote', content, { postId: payload.postId });
}

export async function handlePayment(payload: PaymentCreatedPayload): Promise<void> {
  if (payload.status !== 'completed') return;

  const prefs = await getPrefs(payload.recipientId);
  if (prefs && !prefs.payment) return;

  const amount = Number(payload.amount).toFixed(2);
  const content = `You received a payment of $${amount}`;

  await prisma.notification.create({
    data: {
      userId: payload.recipientId,
      type: 'payment_received',
      content,
      sourceId: payload.id,
      actorId: payload.senderId,
    },
  });

  await sendPushToUser(payload.recipientId, 'Payment Received', content, {
    paymentId: payload.id,
  });

  if (!prefs || prefs.emailEnabled) {
    await sendEmailDigest(payload.recipientId, 'payment_received', content);
  }
}

export async function handleChatMessage(payload: ChatMessagePayload): Promise<void> {
  for (const recipientId of payload.recipientIds) {
    const prefs = await getPrefs(recipientId);
    if (prefs && !prefs.newMessage) continue;

    // Skip push if recipient is currently online in chat-service (shared Redis)
    const isOnline = await redis.exists(`chat:presence:${recipientId}`);
    if (isOnline) continue;

    const content = 'You have a new message';

    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'new_message',
        content,
        sourceId: payload.conversationId,
        actorId: payload.senderId,
      },
    });

    await sendPushToUser(recipientId, 'New Message', content, {
      type: 'new_message',
      conversationId: payload.conversationId,
      messageId: payload.messageId,
    });
  }
}
