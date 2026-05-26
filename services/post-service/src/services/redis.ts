import Redis from 'ioredis';
import ngeohash from 'ngeohash';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const POST_TTL = 300; // seconds

export const cachePost = async (postId: string, data: object) => {
  await redis.set(`post:${postId}`, JSON.stringify(data), 'EX', POST_TTL);
};

export const getCachedPost = async (postId: string): Promise<object | null> => {
  const raw = await redis.get(`post:${postId}`);
  return raw ? JSON.parse(raw) : null;
};

export const invalidatePost = async (postId: string) => {
  await redis.del(`post:${postId}`);
};

export const addToGeohashTile = async (lat: number, lng: number, postId: string, score: number) => {
  const geohash = ngeohash.encode(lat, lng, 6);
  const key = `geo:${geohash}`;
  await redis.zadd(key, score, postId);
  await redis.expire(key, POST_TTL);
};
