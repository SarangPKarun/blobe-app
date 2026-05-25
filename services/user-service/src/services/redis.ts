import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const blockUser = async (userId: string, blockedUserId: string) => {
  await redis.sadd(`user:${userId}:blocks`, blockedUserId);
};

export const unblockUser = async (userId: string, blockedUserId: string) => {
  await redis.srem(`user:${userId}:blocks`, blockedUserId);
};

export const isUserBlocked = async (userId: string, blockedUserId: string) => {
  return await redis.sismember(`user:${userId}:blocks`, blockedUserId) === 1;
};

export const getBlockedUsers = async (userId: string) => {
  return await redis.smembers(`user:${userId}:blocks`);
};
