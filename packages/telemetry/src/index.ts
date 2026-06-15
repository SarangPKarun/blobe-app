import * as Sentry from '@sentry/node';
import type { FastifyInstance } from 'fastify';

export function initSentry(opts: {
  dsn: string;
  serviceName: string;
  release?: string;
  environment?: string;
}): void {
  if (!opts.dsn) return;

  Sentry.init({
    dsn: opts.dsn,
    release: opts.release,
    environment: opts.environment ?? 'production',
    serverName: opts.serviceName,
    // @sentry/node v8 ships with built-in OTEL integration — traces_sample_rate
    // activates distributed tracing and propagates traceparent headers automatically.
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.prismaIntegration(),
    ],
  });
}

export function registerSentryFastify(fastify: FastifyInstance): void {
  fastify.addHook('onError', async (_request, _reply, error) => {
    Sentry.captureException(error);
  });

  fastify.addHook('onClose', async () => {
    await Sentry.flush(2000);
  });
}

export { Sentry };
