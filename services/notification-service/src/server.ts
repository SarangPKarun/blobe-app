import Fastify from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import authPlugin from './plugins/auth';
import notificationRoutes from './routes/notifications';
import preferenceRoutes from './routes/preferences';
import deviceTokenRoutes from './routes/deviceTokens';
import { connectKafkaConsumer, disconnectKafka } from './services/kafka';

const server = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(authPlugin);
server.register(notificationRoutes, { prefix: '/notifications' });
server.register(preferenceRoutes, { prefix: '/users' });
server.register(deviceTokenRoutes, { prefix: '/device-tokens' });

server.get('/health', async () => ({ status: 'ok' }));

export const buildServer = () => server;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3003;

  server.listen({ port, host: '0.0.0.0' }, async (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    await connectKafkaConsumer();
    console.log(`Notification service listening at ${address}`);
  });

  const shutdown = async () => {
    await disconnectKafka();
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
