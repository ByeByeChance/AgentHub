import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { createHealthServer } from '@agenthub/shared/server';

describe('Core Engine health endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createHealthServer({ serviceName: 'core-engine' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('core-engine');
    expect(body.timestamp).toBeDefined();
    // Verify timestamp is ISO 8601
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it('should return application/json content type', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
