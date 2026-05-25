import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { publishUserCreated } from '../services/kafka';

export default async function (fastify: FastifyInstance) {
  // Check username uniqueness
  fastify.get(
    '/check-username',
    {
      schema: {
        querystring: z.object({
          username: z.string().min(3),
        }),
      },
    },
    async (request, reply) => {
      const { username } = request.query as { username: string };
      const user = await prisma.user.findUnique({ where: { username } });
      return { available: !user };
    }
  );

  // Register a new user
  fastify.post(
    '/',
    {
      schema: {
        body: z.object({
          username: z.string().min(3),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const body = request.body as { username: string; email?: string; phone?: string };
      
      // Verify Firebase ID token
      const decodedToken = await fastify.verifyFirebaseToken(request, reply);
      
      // Check if username is already taken
      const existingUser = await prisma.user.findUnique({ where: { username: body.username } });
      if (existingUser) {
        return reply.code(409).send({ error: 'Username is already taken' });
      }

      // Check if phone or email is already taken
      if (body.email) {
        const emailUser = await prisma.user.findUnique({ where: { email: body.email } });
        if (emailUser) return reply.code(409).send({ error: 'Email is already taken' });
      }

      if (body.phone) {
        const phoneUser = await prisma.user.findUnique({ where: { phone: body.phone } });
        if (phoneUser) return reply.code(409).send({ error: 'Phone is already taken' });
      }

      // We might want to link the firebase UID, but currently the schema doesn't have firebaseUid.
      // We will use the generated ID or maybe use firebase UID as the user ID.
      // Let's use standard UUID and we could add firebaseUid later if needed.
      const newUser = await prisma.user.create({
        data: {
          username: body.username,
          email: body.email || decodedToken.email,
          phone: body.phone || decodedToken.phone_number,
        },
      });

      // Publish event
      await publishUserCreated(newUser);

      // Issue internal JWT
      const token = fastify.jwt.sign({
        id: newUser.id,
        email: newUser.email || undefined,
        phone: newUser.phone || undefined,
      });

      return reply.code(201).send({ user: newUser, token });
    }
  );

  // Get user profile
  fastify.get(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          _count: {
            select: { followers: true, following: true, posts: true },
          },
        },
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return user;
    }
  );

  // Update user profile
  fastify.patch(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        body: z.object({
          username: z.string().min(3).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      
      // Ensure the user is updating their own profile
      if (request.user.id !== id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: body,
      });

      return updatedUser;
    }
  );

  // Delete user (GDPR)
  fastify.delete(
    '/:id',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      
      if (request.user.id !== id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Hard delete (cascading deletes depend on Prisma configuration or manual deletion)
      // Usually you would anonymize or delete related records first.
      await prisma.user.delete({
        where: { id },
      });

      return reply.code(204).send();
    }
  );
}
