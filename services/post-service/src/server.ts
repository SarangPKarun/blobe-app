import './instrument';
import { registerSentryFastify } from './instrument';
import Fastify from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import authPlugin from './plugins/auth';
import postRoutes from './routes/posts';
import { connectKafka, disconnectKafka } from './services/kafka';

const server = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();
registerSentryFastify(server);

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(authPlugin);
server.register(postRoutes, { prefix: '/posts' });

server.get('/health', async () => {
  return { status: 'ok' };
});

export const buildServer = () => server;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3002;

  server.listen({ port, host: '0.0.0.0' }, async (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    await connectKafka();
    console.log(`Server listening at ${address}`);
  });

  const shutdown = async () => {
    await disconnectKafka();
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
