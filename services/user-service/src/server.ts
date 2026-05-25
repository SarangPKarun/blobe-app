import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import authPlugin from './plugins/auth';
import userRoutes from './routes/users';
import followRoutes from './routes/follows';
import blockRoutes from './routes/blocks';

const server = Fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>();

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
  server.listen({ port: 3001, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
}
