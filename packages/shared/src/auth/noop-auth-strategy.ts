import type { AuthStrategy, AuthRequest, AuthResult } from './interfaces/auth-strategy.interface.js';

/** Passthrough auth strategy — always authenticates. For development and testing only. */
export class NoopAuthStrategy implements AuthStrategy {
  readonly name = 'noop';

  async authenticate(_request: AuthRequest): Promise<AuthResult> {
    return {
      authenticated: true,
      identity: { clientId: 'noop-client', scopes: ['*'] },
    };
  }
}
