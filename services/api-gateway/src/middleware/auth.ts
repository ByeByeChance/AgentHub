import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthStrategy, AuthRequest } from '@agenthub/shared/auth';

/**
 * Register an authentication preHandler hook on all /api/* routes.
 *
 * Ported from services/core-engine/src/auth/middleware.ts (now the canonical
 * location for HTTP-level auth in the gateway).
 *
 * Extracts headers/method/url into a framework-agnostic AuthRequest,
 * calls the AuthStrategy, and returns 401 on failure.
 * Attaches successful auth identity to `request.auth`.
 */
export function registerAuthMiddleware(
  app: FastifyInstance,
  authStrategy: AuthStrategy,
): void {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only apply to /api/* routes; skip health and other public paths
    if (!request.url.startsWith('/api/')) return;

    const authRequest: AuthRequest = {
      headers: request.headers as Record<string, string | string[] | undefined>,
      method: request.method,
      url: request.url,
    };

    const result = await authStrategy.authenticate(authRequest);

    if (!result.authenticated) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: result.error ?? 'Authentication failed',
      });
    }

    // Attach identity to request for downstream handlers
    (request as AuthFastifyRequest).auth = result.identity;
  });
}

/** Extended FastifyRequest with auth identity attached by the middleware. */
export interface AuthFastifyRequest extends FastifyRequest {
  auth?: {
    clientId: string;
    scopes: string[];
  };
}
