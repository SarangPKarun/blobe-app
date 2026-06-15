import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';
import { publishUserCreated, publishUserDeleted } from '../services/kafka';

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

      // Issue internal JWT — iss claim lets Kong identify the consumer
      const token = fastify.jwt.sign(
        { id: newUser.id, email: newUser.email || undefined, phone: newUser.phone || undefined },
        { issuer: 'blobe-app' }
      );

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

  // Delete user account — GDPR right to erasure (Article 17 GDPR)
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

      // Deletion order matters: child records with FK constraints must be removed
      // before parent records. Payment FKs are nulled (not deleted) for financial audit compliance.
      await prisma.$transaction([
        // 1. Ad bids — no other table references these
        prisma.adBid.deleteMany({ where: { userId: id } }),
        // 2. Anonymise payments (null sender/recipient; records kept for financial audit)
        prisma.payment.updateMany({ where: { senderId: id }, data: { senderId: null } }),
        prisma.payment.updateMany({ where: { recipientId: id }, data: { recipientId: null } }),
        // 3. Null campaignId on payments that point to this user's campaigns (unblocks campaign delete)
        prisma.payment.updateMany({
          where: { campaign: { creatorId: id } },
          data: { campaignId: null },
        }),
        // 4. Campaigns
        prisma.campaign.deleteMany({ where: { creatorId: id } }),
        // 5. Votes on this user's posts (other users' votes; unblocks post delete)
        prisma.vote.deleteMany({ where: { post: { authorId: id } } }),
        // 6. This user's own votes on others' posts
        prisma.vote.deleteMany({ where: { userId: id } }),
        // 7. Chat messages sent by this user (unblocks user delete — no cascade on senderId)
        prisma.chatMessage.updateMany({ where: { senderId: id }, data: { isDeleted: true } }),
        // 8. Posts
        prisma.post.deleteMany({ where: { authorId: id } }),
        // 9. Follows
        prisma.follows.deleteMany({ where: { OR: [{ followerId: id }, { followingId: id }] } }),
        // 10. Trust score
        prisma.trustScore.deleteMany({ where: { userId: id } }),
        // 11. Audit log (no FK to User — survives deletion intentionally)
        prisma.userDeletionLog.create({
          data: { userId: id, requestIp: request.ip ?? 'unknown' },
        }),
        // 12. Delete user — cascades: Notification, NotificationPreference, DeviceToken,
        //     StripeAccount, UserPublicKey, ConversationParticipant
        prisma.user.delete({ where: { id } }),
      ]);

      // Notify downstream services to clean up their own stores (ES index, Redis cache, etc.)
      await publishUserDeleted(id);

      return reply.code(204).send();
    }
  );
}
