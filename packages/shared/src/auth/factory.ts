import type { AuthStrategy } from './interfaces/auth-strategy.interface.js';
import { NoopAuthStrategy } from './noop-auth-strategy.js';
import { APIKeyStrategy } from './api-key-strategy.js';

/**
 * Create an AuthStrategy instance based on the AUTH_STRATEGY env var.
 *
 * - `api-key` → APIKeyStrategy (validates Authorization: Bearer header)
 * - `noop` or unset → NoopAuthStrategy (always authenticates, for dev/test)
 */
export function createAuthStrategy(): AuthStrategy {
  const strategy = process.env.AUTH_STRATEGY ?? 'noop';

  if (strategy === 'api-key') {
    return new APIKeyStrategy();
  }

  return new NoopAuthStrategy();
}
