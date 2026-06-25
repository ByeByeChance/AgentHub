import type { AuthStrategy, AuthRequest, AuthResult } from './interfaces/auth-strategy.interface.js';

/**
 * Validates requests using a pre-shared API key.
 *
 * Keys are loaded from the AGENTHUB_API_KEYS env var (comma-separated list).
 * The request must include an `Authorization: Bearer <key>` header.
 */
export class APIKeyStrategy implements AuthStrategy {
  readonly name = 'api-key';

  private readonly validKeys: Set<string>;

  constructor(keys?: string[]) {
    if (keys && keys.length > 0) {
      this.validKeys = new Set(keys);
    } else {
      const envKeys = process.env.AGENTHUB_API_KEYS ?? '';
      this.validKeys = new Set(
        envKeys
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      );
    }
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    if (this.validKeys.size === 0) {
      return {
        authenticated: false,
        error: 'No API keys configured — set AGENTHUB_API_KEYS environment variable',
      };
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return {
        authenticated: false,
        error: 'Missing Authorization header',
      };
    }

    // Handle both string and string[] header values
    const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (!headerValue) {
      return { authenticated: false, error: 'Empty Authorization header' };
    }

    const bearerMatch = /^[Bb]earer\s+(.+)$/.exec(headerValue);
    if (!bearerMatch) {
      return {
        authenticated: false,
        error: 'Authorization header must use Bearer scheme',
      };
    }

    const key = bearerMatch[1]?.trim() ?? '';
    if (!key) {
      return { authenticated: false, error: 'Empty Bearer token' };
    }

    if (this.validKeys.has(key)) {
      return {
        authenticated: true,
        identity: { clientId: `apikey:${this.maskKey(key)}`, scopes: ['api'] },
      };
    }

    return {
      authenticated: false,
      error: 'Invalid API key',
    };
  }

  /** Mask a key for identity display: show last 4 chars only. */
  private maskKey(key: string): string {
    if (key.length <= 4) return '****';
    return '****' + key.slice(-4);
  }
}
