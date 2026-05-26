import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

export default async function (fastify: FastifyInstance) {
  // POST /device-tokens — register or refresh a device token
  fastify.post(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        body: z.object({
          token: z.string().min(1),
          platform: z.enum(['android', 'ios']),
        }),
      },
    },
    async (request, reply) => {
      const { token, platform } = request.body as { token: string; platform: 'android' | 'ios' };
      const userId = request.user.id;

      const deviceToken = await prisma.deviceToken.upsert({
        where: { token },
        create: { userId, token, platform, active: true },
        update: { userId, active: true, updatedAt: new Date() },
      });

      return reply.code(201).send(deviceToken);
    }
  );

  // DELETE /device-tokens — soft-delete (deactivate) a device token
  fastify.delete(
    '/',
    {
      preValidation: [fastify.authenticate],
      schema: {
        body: z.object({
          token: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      const { token } = request.body as { token: string };
      const userId = request.user.id;

      await prisma.deviceToken.updateMany({
        where: { token, userId },
        data: { active: false },
      });

      return reply.send({ success: true });
    }
  );
}
