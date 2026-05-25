import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { buildServer } from '../server';
import { prisma } from '../services/db';

vi.mock('../services/kafka', () => ({
  connectKafka: vi.fn(),
  disconnectKafka: vi.fn(),
  publishUserCreated: vi.fn(),
}));

vi.mock('../services/redis', () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  isUserBlocked: vi.fn().mockResolvedValue(false),
  getBlockedUsers: vi.fn().mockResolvedValue([]),
}));

describe('User Service API', () => {
  let container: StartedPostgreSqlContainer;
  let server: any;

  beforeAll(async () => {
    // Start Postgres container
    container = await new PostgreSqlContainer('postgis/postgis:15-3.3').start();

    const databaseUrl = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}`;
    process.env.DATABASE_URL = databaseUrl;

    // Run Prisma migrations
    execSync('npx prisma db push', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      cwd: '../../packages/database',
    });

    server = buildServer();
    await server.ready();
  }, 60000);

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
    if (container) {
      await container.stop();
    }
  });

  it('GET /health returns ok', async () => {
    const response = await request(server.server).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /users/check-username returns available for new username', async () => {
    const response = await request(server.server).get('/users/check-username?username=testuser');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ available: true });
  });

  it('POST /users registers a new user', async () => {
    const response = await request(server.server)
      .post('/users')
      .set('Authorization', 'Bearer MOCK_TOKEN')
      .send({
        username: 'testuser',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user.username).toBe('testuser');
  });

  it('GET /users/check-username returns unavailable after registration', async () => {
    const response = await request(server.server).get('/users/check-username?username=testuser');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ available: false });
  });
});
