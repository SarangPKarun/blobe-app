import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  studio: {},
  migrate: {
    connectionString: process.env.DATABASE_URL,
  },
});
