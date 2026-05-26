import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { publishPostCreated } from '../services/kafka';
import { cachePost, getCachedPost, invalidatePost, addToGeohashTile } from '../services/redis';
import { getUploadUrl } from '../services/s3';

const CreatePostBody = z.object({
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  title:     z.string().min(1),
  content:   z.string().optional(),
  frontText: z.string().optional(),
  backText:  z.string().optional(),
});

type PostRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  content: string | null;
  authorId: string;
  frontText: string | null;
  backText: string | null;
  mediaUrl: string | null;
  latitude: number;
  longitude: number;
};

export default async function (fastify: FastifyInstance) {
  // POST /posts — create a new post with GPS coordinates
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        body: CreatePostBody,
      },
    },
    async (request, reply) => {
      const { latitude, longitude, title, content, frontText, backText } =
        request.body as z.infer<typeof CreatePostBody>;
      const authorId = request.user.id;

      const [post] = await prisma.$queryRaw<PostRow[]>`
        INSERT INTO "Post" (
          id, "createdAt", "updatedAt", title, content, "authorId",
          "frontText", "backText", location
        )
        VALUES (
          gen_random_uuid(), now(), now(),
          ${title}, ${content ?? null}, ${authorId},
          ${frontText ?? null}, ${backText ?? null},
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
        )
        RETURNING
          id, "createdAt", "updatedAt", title, content, "authorId",
          "frontText", "backText", "mediaUrl",
          ST_X(location::geometry) AS longitude,
          ST_Y(location::geometry) AS latitude
      `;

      const uploadUrl = await getUploadUrl(post.id);

      const score = Date.now();
      await Promise.all([
        cachePost(post.id, post),
        addToGeohashTile(post.latitude, post.longitude, post.id, score),
        publishPostCreated({
          id: post.id,
          authorId: post.authorId,
          latitude: post.latitude,
          longitude: post.longitude,
          frontText: post.frontText,
          backText: post.backText,
          mediaUrl: post.mediaUrl,
          createdAt: post.createdAt,
        }),
      ]);

      return reply.code(201).send({ post, uploadUrl });
    }
  );

  // GET /posts/:id — fetch a single post (Redis-first)
  fastify.get(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const cached = await getCachedPost(id);
      if (cached) {
        return cached;
      }

      const [post] = await prisma.$queryRaw<PostRow[]>`
        SELECT
          id, "createdAt", "updatedAt", title, content, "authorId",
          "frontText", "backText", "mediaUrl",
          ST_X(location::geometry) AS longitude,
          ST_Y(location::geometry) AS latitude
        FROM "Post"
        WHERE id = ${id}
      `;

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      await cachePost(id, post);
      return post;
    }
  );

  // DELETE /posts/:id — owner-only hard delete
  fastify.delete(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const post = await prisma.post.findUnique({ where: { id } });

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      if (post.authorId !== request.user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      await prisma.post.delete({ where: { id } });
      await invalidatePost(id);

      return reply.code(204).send();
    }
  );
}
