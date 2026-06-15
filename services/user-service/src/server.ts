import './instrument';
import { registerSentryFastify } from './instrument';
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import authPlugin from './plugins/auth';
import userRoutes from './routes/users';
import followRoutes from './routes/follows';
import blockRoutes from './routes/blocks';
import { connectKafka, disconnectKafka } from './services/kafka';

const server = Fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>();
registerSentryFastify(server);

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Register plugins
server.register(authPlugin);

// Register routes
server.register(userRoutes, { prefix: '/users' });
server.register(followRoutes, { prefix: '/users' });
server.register(blockRoutes, { prefix: '/users' });

server.get('/health', async () => {
  return { status: 'ok' };
});

export const buildServer = () => {
  return server;
};

if (require.main === module) {
  server.listen({ port: 3001, host: '0.0.0.0' }, async (err, address) => {
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
