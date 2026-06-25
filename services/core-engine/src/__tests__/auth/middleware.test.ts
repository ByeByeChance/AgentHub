import { describe, it, expect, beforeEach } from 'vitest';
import { createHealthServer } from '@agenthub/shared/server';
import { APIKeyStrategy, NoopAuthStrategy, type AuthStrategy } from '@agenthub/shared/auth';
import { registerAuthMiddleware } from '../../auth/middleware.js';

/** Build a Fastify app with auth middleware registered for testing. */
async function buildApp(strategy: AuthStrategy) {
  const app = createHealthServer({ serviceName: 'test-auth', port: 0 });
  registerAuthMiddleware(app, strategy);

  // Add a test route behind auth
  app.get('/api/test', async (request) => {
    const auth = (request as unknown as Record<string, unknown>).auth as { clientId?: string } | undefined;
    return { ok: true, clientId: auth?.clientId };
  });

  app.get('/api/agents', async () => {
    return [{ id: '1', name: 'Test Agent' }];
  });

  await app.ready();
  return app;
}

describe('Auth Middleware', () => {
  describe('with NoopAuthStrategy', () => {
    let app: Awaited<ReturnType<typeof buildApp>>;

    beforeEach(async () => {
      app = await buildApp(new NoopAuthStrategy());
    });

    it('should allow requests to /api/* without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.ok).toBe(true);
    });

    it('should attach noop identity to request', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/test' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.clientId).toBe('noop-client');
    });

    it('should allow requests to /health without auth check', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('with APIKeyStrategy', () => {
    const validKey = 'sk-test-key-123';

    it('should allow requests with valid API key', async () => {
      const strategy = new APIKeyStrategy([validKey]);
      const app = await buildApp(strategy);
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents',
        headers: { authorization: `Bearer ${validKey}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should reject requests with missing Authorization header', async () => {
      const strategy = new APIKeyStrategy([validKey]);
      const app = await buildApp(strategy);
      const res = await app.inject({ method: 'GET', url: '/api/agents' });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid API key', async () => {
      const strategy = new APIKeyStrategy([validKey]);
      const app = await buildApp(strategy);
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents',
        headers: { authorization: 'Bearer wrong-key' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject requests with non-Bearer scheme', async () => {
      const strategy = new APIKeyStrategy([validKey]);
      const app = await buildApp(strategy);
      const res = await app.inject({
        method: 'GET',
        url: '/api/agents',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should not apply auth to /health endpoint', async () => {
      const strategy = new APIKeyStrategy([validKey]);
      const app = await buildApp(strategy);
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    });
  });
});
