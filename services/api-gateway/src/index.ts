// Load .env from project root
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
try { process.loadEnvFile?.(resolve(root, '.env')); } catch { /* optional */ }

import Fastify from 'fastify';
import { SERVICE_DEFAULTS } from '@agenthub/shared/constants';
import { createAuthStrategy } from '@agenthub/shared/auth';
import { createPinoLogger } from '@agenthub/shared/logging';
import { registerAuthMiddleware } from './middleware/auth.js';
import { registerRateLimitMiddleware } from './middleware/rate-limit.js';
import { registerCorsMiddleware } from './middleware/cors.js';
import { createProxyHandler } from './proxy.js';

const port = Number(process.env.API_GATEWAY_PORT) || SERVICE_DEFAULTS.ports.apiGateway || 3000;

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });
  const logger = createPinoLogger(app.log, { service: 'api-gateway' });

  // Health check (no auth required)
  app.get('/health', async () => ({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  }));

  // CORS — must be registered before other middleware
  registerCorsMiddleware(app);

  // Auth middleware — validates API keys on /api/* routes
  const authStrategy = createAuthStrategy();
  registerAuthMiddleware(app, authStrategy);

  // HTTP-level rate limiting — protects /api/* routes
  registerRateLimitMiddleware(app, logger);

  // Proxy all /api/* requests to Core Engine
  const coreEngineUrl = process.env.CORE_ENGINE_URL ?? 'http://localhost:3001';
  const proxyHandler = createProxyHandler(coreEngineUrl, logger);
  app.route({
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    url: '/api/*',
    handler: proxyHandler,
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`api-gateway received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port, host: SERVICE_DEFAULTS.host });
    logger.info(`api-gateway listening on :${port}, proxying to ${coreEngineUrl}`);
  } catch (err) {
    logger.error('api-gateway failed to start', { error: String(err) });
    process.exit(1);
  }
}

void main();
