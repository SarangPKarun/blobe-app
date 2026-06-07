import Fastify from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import authPlugin from './plugins/auth';
import connectRoutes from './routes/connect';
import campaignRoutes from './routes/campaigns';
import donationRoutes from './routes/donations';
import adBidRoutes from './routes/adBids';
import webhookRoutes from './routes/webhook';
import earningsRoutes from './routes/earnings';
import { connectKafka, disconnectKafka } from './services/kafka';
import { startScheduler, stopScheduler } from './services/scheduler';

const server = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Preserve raw body for Stripe webhook signature verification
server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  try {
    (req as any).rawBody = body;
    done(null, JSON.parse(body.toString()));
  } catch (err: any) {
    done(err, undefined);
  }
});

server.register(authPlugin);
server.register(webhookRoutes);       // webhook first — uses raw body, no auth
server.register(connectRoutes);
server.register(campaignRoutes);
server.register(donationRoutes);
server.register(adBidRoutes);
server.register(earningsRoutes);

server.get('/health', async () => ({ status: 'ok' }));

export const buildServer = () => server;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3008;

  server.listen({ port, host: '0.0.0.0' }, async (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    await connectKafka();
    startScheduler();
    console.log(`Payment service listening at ${address}`);
  });

  const shutdown = async () => {
    stopScheduler();
    await disconnectKafka();
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
