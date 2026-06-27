import Fastify, { type FastifyInstance } from 'fastify';
import type { HealthServerOptions } from './interfaces/health-server.interface.js';
import { registerErrorHandler } from '../errors/fastify-error-handler.js';

export function createHealthServer(options: HealthServerOptions): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // Register RFC 9457 global error handler (enabled by default)
  if (options.registerErrorHandler !== false) {
    registerErrorHandler(app);
  }

  app.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      service: options.serviceName,
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}
