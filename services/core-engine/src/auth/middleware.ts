import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthStrategy, AuthRequest } from '@agenthub/shared/auth';
import { isApiPath } from '@agenthub/shared/constants';
import { ProblemDetail, ERROR_TYPES } from '@agenthub/shared/errors';

/**
 * Register an authentication preHandler hook on all /api/* routes.
 *
 * Extracts headers/method/url into a framework-agnostic AuthRequest,
 * calls the AuthStrategy, and returns 401 on failure.
 * Attaches successful auth identity to `request.auth`.
 */
export function registerAuthMiddleware(
  app: FastifyInstance,
  authStrategy: AuthStrategy,
): void {
  app.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Only apply to /api/* routes; skip health and other public paths
    if (!isApiPath(request.url)) return;

    const authRequest: AuthRequest = {
      headers: request.headers as Record<string, string | string[] | undefined>,
      method: request.method,
      url: request.url,
    };

    const result = await authStrategy.authenticate(authRequest);

    if (!result.authenticated) {
      throw new ProblemDetail({
        type: ERROR_TYPES.UNAUTHORIZED,
        title: 'Unauthorized',
        status: 401,
        detail: result.error ?? 'Authentication failed',
        instance: request.url,
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
