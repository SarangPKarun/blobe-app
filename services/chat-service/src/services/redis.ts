import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PRESENCE_TTL = 65;
const presenceKey = (userId: string) => `chat:presence:${userId}`;

export const setUserOnline = (userId: string, socketId: string) =>
  redis.setex(presenceKey(userId), PRESENCE_TTL, socketId);

export const setUserOffline = (userId: string) =>
  redis.del(presenceKey(userId));

export const refreshPresence = (userId: string) =>
  redis.expire(presenceKey(userId), PRESENCE_TTL);

export const isUserOnline = async (userId: string) =>
  (await redis.exists(presenceKey(userId))) === 1;
