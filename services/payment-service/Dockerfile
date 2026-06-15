# NOTE: Stripe webhook routes require raw body access for signature verification.
# Fastify's addContentTypeParser with parseAs:'buffer' is used in src/ — no build
# changes needed here. Ensure STRIPE_WEBHOOK_SECRET is set in the runtime environment.

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
COPY --from=base /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
USER nodejs
EXPOSE 3008
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3008/health || exit 1
CMD ["node", "dist/server.js"]
