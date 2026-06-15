import { initSentry, registerSentryFastify } from '@blobe/telemetry';
export { registerSentryFastify };

initSentry({
  dsn: process.env.SENTRY_DSN ?? '',
  serviceName: 'notification-service',
  release: process.env.SENTRY_RELEASE,
  environment: process.env.SENTRY_ENVIRONMENT,
});
