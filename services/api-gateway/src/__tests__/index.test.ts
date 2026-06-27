import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerCorsMiddleware } from '../middleware/cors.js';
import { registerRateLimitMiddleware } from '../middleware/rate-limit.js';
import { createPinoLogger } from '@agenthub/shared/logging';

describe('API Gateway', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    const logger = createPinoLogger(app.log, { service: 'test-gateway' });

    app.get('/health', async () => ({ status: 'ok' }));

    registerCorsMiddleware(app);
    registerRateLimitMiddleware(app, logger);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
    });
  });

  describe('CORS', () => {
    it('should set CORS headers on requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents',
        headers: { origin: 'http://localhost:3000' },
      });
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should handle OPTIONS preflight', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/agents',
        headers: { origin: 'http://localhost:3000' },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents',
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });
      // Rate limiter allows or forwards (actual status depends on proxy)
      expect([200, 404, 502, 503]).toContain(res.statusCode);
    });
  });
});
