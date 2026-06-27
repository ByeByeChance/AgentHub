import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Register CORS middleware with configurable origins.
 *
 * Reads CORS_ORIGINS from env (comma-separated, default: http://localhost:3000).
 * Allows standard methods and headers needed by the AgentHub frontend.
 */
export function registerCorsMiddleware(app: FastifyInstance): void {
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim());

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;
    const isAllowed = origin && origins.includes(origin);

    reply.header('Access-Control-Allow-Origin', isAllowed ? origin! : origins[0]!);
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, Accept');
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Max-Age', '86400');

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });
}
