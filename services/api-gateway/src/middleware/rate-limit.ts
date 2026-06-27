import type { FastifyInstance, FastifyRequest } from 'fastify';
import { RateLimiter } from '@agenthub/shared/reliability';
import type { Logger } from '@agenthub/shared/logging';
import { isApiPath } from '@agenthub/shared/constants';
import { ProblemDetail, ERROR_TYPES } from '@agenthub/shared/errors';

/**
 * Register HTTP-level rate limiting as a preHandler hook.
 *
 * Uses the shared token-bucket RateLimiter. Each client IP gets its own
 * bucket. This is separate from the SafetyNet rate limiter inside Core
 * Engine — the gateway protects the HTTP edge, SafetyNet protects agent
 * execution.
 */
export function registerRateLimitMiddleware(
  app: FastifyInstance,
  logger: Logger,
): void {
  const rateLimiter = new RateLimiter();

  app.addHook('preHandler', async (request: FastifyRequest) => {
    if (!isApiPath(request.url)) return;

    const clientKey = request.ip ?? 'unknown';

    if (!rateLimiter.consume(clientKey)) {
      logger.warn('Gateway rate limit exceeded', { clientKey, url: request.url });
      throw new ProblemDetail({
        type: ERROR_TYPES.RATE_LIMITED,
        title: 'Too Many Requests',
        status: 429,
        detail: 'Rate limit exceeded. Please retry later.',
        instance: request.url,
      });
    }
  });
}
