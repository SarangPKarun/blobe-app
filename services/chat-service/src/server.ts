import Fastify from 'fastify';
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import authPlugin from './plugins/auth';
import conversationRoutes from './routes/conversations';
import keyRoutes from './routes/keys';
import { registerSocketHandlers } from './socket/handlers';
import { connectKafkaProducer, disconnectKafka } from './services/kafka';

const fastify = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

fastify.register(cors, { origin: '*' });
fastify.register(authPlugin);
fastify.register(conversationRoutes, { prefix: '/conversations' });
fastify.register(keyRoutes, { prefix: '/keys' });
fastify.get('/health', async () => ({ status: 'ok' }));

if (require.main === module) {
  const port = Number(process.env.PORT) || 3009;

  // Attach Socket.io to Fastify's underlying http.Server after Fastify is ready
  fastify.ready((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    const io = new SocketIOServer(fastify.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling'],
    });

    registerSocketHandlers(io);

    fastify.server.listen(port, '0.0.0.0', async () => {
      await connectKafkaProducer();
      console.log(`chat-service listening on port ${port}`);
    });
  });

  const shutdown = async () => {
    await disconnectKafka();
    await fastify.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default fastify;
