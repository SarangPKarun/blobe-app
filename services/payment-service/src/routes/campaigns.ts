import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/db';

const CreateCampaignBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  goalAmount: z.number().int().positive(),
  dueDate: z.string().datetime().optional(),
});

export default async function (fastify: FastifyInstance) {
  // Create a fundraising campaign (escrow container)
  fastify.post(
    '/campaigns',
    {
      preValidation: [fastify.authenticate],
      schema: { body: CreateCampaignBody },
    },
    async (request, reply) => {
      const { title, description, goalAmount, dueDate } = request.body as z.infer<typeof CreateCampaignBody>;
      const creatorId = request.user.id;

      const campaign = await prisma.campaign.create({
        data: {
          creatorId,
          title,
          description,
          goalAmount,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
      });

      return reply.code(201).send({ campaign });
    }
  );

  // Get a campaign by ID
  fastify.get(
    '/campaigns/:id',
    {
      preValidation: [fastify.authenticate],
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const campaign = await prisma.campaign.findUnique({
        where: { id },
        include: { creator: { select: { id: true, username: true } } },
      });
      if (!campaign) return reply.code(404).send({ error: 'Campaign not found' });
      return campaign;
    }
  );
}
