import Fastify, { type FastifyInstance } from 'fastify';
import type { HealthServerOptions } from './interfaces/health-server.interface.js';

export function createHealthServer(options: HealthServerOptions): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  app.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      service: options.serviceName,
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}
