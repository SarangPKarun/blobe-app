import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';
import admin from 'firebase-admin';

if (!admin.apps.length && process.env.FIREBASE_PROJECT_ID) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

export interface UserPayload {
  id: string;
  email?: string;
  phone?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyFirebaseToken: (request: FastifyRequest, reply: FastifyReply) => Promise<admin.auth.DecodedIdToken>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserPayload;
    user: UserPayload;
  }
}

export default fp(async (fastify) => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized: Invalid or missing token' });
    }
  });

  fastify.decorate('verifyFirebaseToken', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized: Missing Firebase Token' });
      throw new Error('Missing token');
    }

    const token = authHeader.split(' ')[1];

    if (process.env.NODE_ENV === 'test') {
      return { uid: 'test-firebase-uid', email: 'test@example.com' } as admin.auth.DecodedIdToken;
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      return decodedToken;
    } catch (error) {
      reply.code(401).send({ error: 'Unauthorized: Invalid Firebase Token' });
      throw error;
    }
  });
});
