import { describe, it, expect, afterEach } from 'vitest';
import { NoopAuthStrategy } from '../../auth/noop-auth-strategy.js';
import { APIKeyStrategy } from '../../auth/api-key-strategy.js';
import { createAuthStrategy } from '../../auth/factory.js';
import type { AuthRequest } from '../../auth/interfaces/auth-strategy.interface.js';

function makeRequest(headers: Record<string, string> = {}): AuthRequest {
  return { headers, method: 'GET', url: '/api/agents' };
}

describe('AuthStrategy', () => {
  describe('NoopAuthStrategy', () => {
    it('should have name "noop"', () => {
      const s = new NoopAuthStrategy();
      expect(s.name).toBe('noop');
    });

    it('should always authenticate with wildcard scopes', async () => {
      const s = new NoopAuthStrategy();
      const result = await s.authenticate(makeRequest());
      expect(result.authenticated).toBe(true);
      expect(result.identity).toEqual({ clientId: 'noop-client', scopes: ['*'] });
    });

    it('should authenticate even with no headers', async () => {
      const s = new NoopAuthStrategy();
      const result = await s.authenticate({ headers: {}, method: 'POST', url: '/api/conversations' });
      expect(result.authenticated).toBe(true);
    });
  });

  describe('APIKeyStrategy', () => {
    const validKey = 'test-key-1234567890';

    it('should have name "api-key"', () => {
      const s = new APIKeyStrategy([validKey]);
      expect(s.name).toBe('api-key');
    });

    it('should authenticate with valid Bearer token', async () => {
      const s = new APIKeyStrategy([validKey]);
      const result = await s.authenticate(makeRequest({ authorization: `Bearer ${validKey}` }));
      expect(result.authenticated).toBe(true);
      expect(result.identity?.clientId).toContain('apikey:');
      expect(result.identity?.scopes).toEqual(['api']);
    });

    it('should reject missing Authorization header', async () => {
      const s = new APIKeyStrategy([validKey]);
      const result = await s.authenticate(makeRequest({}));
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Missing Authorization header');
    });

    it('should reject non-Bearer scheme', async () => {
      const s = new APIKeyStrategy([validKey]);
      const result = await s.authenticate(makeRequest({ authorization: 'Basic dXNlcjpwYXNz' }));
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Bearer scheme');
    });

    it('should reject empty Bearer token', async () => {
      const s = new APIKeyStrategy([validKey]);
      const result = await s.authenticate(makeRequest({ authorization: 'Bearer  ' }));
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Empty Bearer token');
    });

    it('should reject invalid API key', async () => {
      const s = new APIKeyStrategy([validKey]);
      const result = await s.authenticate(makeRequest({ authorization: 'Bearer wrong-key' }));
      expect(result.authenticated).toBe(false);
      expect(result.error).toContain('Invalid API key');
    });

    it('should support multiple valid keys', async () => {
      const s = new APIKeyStrategy(['key-a', 'key-b']);
      const r1 = await s.authenticate(makeRequest({ authorization: 'Bearer key-a' }));
      expect(r1.authenticated).toBe(true);

      const r2 = await s.authenticate(makeRequest({ authorization: 'Bearer key-b' }));
      expect(r2.authenticated).toBe(true);

      const r3 = await s.authenticate(makeRequest({ authorization: 'Bearer key-c' }));
      expect(r3.authenticated).toBe(false);
    });

    it('should report error when no keys configured', async () => {
      // Save and clear env
      const prev = process.env.AGENTHUB_API_KEYS;
      delete process.env.AGENTHUB_API_KEYS;
      try {
        const s = new APIKeyStrategy();
        const result = await s.authenticate(makeRequest({ authorization: 'Bearer some-key' }));
        expect(result.authenticated).toBe(false);
        expect(result.error).toContain('No API keys configured');
      } finally {
        if (prev) process.env.AGENTHUB_API_KEYS = prev;
      }
    });

    it('should mask key in identity (show only last 4 chars)', async () => {
      const s = new APIKeyStrategy(['sk-abcdefghijklmnop']);
      const result = await s.authenticate(makeRequest({ authorization: 'Bearer sk-abcdefghijklmnop' }));
      expect(result.authenticated).toBe(true);
      expect(result.identity?.clientId).toBe('apikey:****mnop');
    });

    it('should handle array-type Authorization header', async () => {
      const s = new APIKeyStrategy([validKey]);
      const req: AuthRequest = {
        headers: { authorization: [`Bearer ${validKey}`] },
        method: 'GET',
        url: '/',
      };
      const result = await s.authenticate(req);
      expect(result.authenticated).toBe(true);
    });
  });

  describe('AuthStrategy factory', () => {
    afterEach(() => {
      delete process.env.AUTH_STRATEGY;
    });

    it('should return NoopAuthStrategy when AUTH_STRATEGY=noop', () => {
      process.env.AUTH_STRATEGY = 'noop';
      const s = createAuthStrategy();
      expect(s.name).toBe('noop');
    });

    it('should return NoopAuthStrategy when AUTH_STRATEGY unset', () => {
      const s = createAuthStrategy();
      expect(s.name).toBe('noop');
    });

    it('should return APIKeyStrategy when AUTH_STRATEGY=api-key', () => {
      process.env.AGENTHUB_API_KEYS = 'test-key';
      process.env.AUTH_STRATEGY = 'api-key';
      try {
        const s = createAuthStrategy();
        expect(s.name).toBe('api-key');
      } finally {
        delete process.env.AGENTHUB_API_KEYS;
      }
    });
  });
});
