import type { AuditLoggerLike } from '../services/interfaces/agent-runner.interface.js';
import type { Logger } from '@agenthub/shared/logging';

/**
 * HTTP-client AuditLogger that POSTs to the observability service API.
 *
 * Sends audit log entries to POST /api/obs/audit on the observability
 * service, which persists them with SHA-256 chain verification.
 * Falls back to structured logging when the HTTP request fails.
 */
export class HttpAuditLogger implements AuditLoggerLike {
  private readonly observabilityUrl: string;

  constructor(
    private logger: Logger,
    observabilityUrl?: string,
  ) {
    this.observabilityUrl = (observabilityUrl ?? process.env.OBSERVABILITY_URL ?? 'http://localhost:3004').replace(/\/$/, '');
  }

  async log(input: {
    entryType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.observabilityUrl}/api/obs/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.warn('Observability audit log returned non-ok status', {
          status: response.status,
          entryType: input.entryType,
        });
      }
    } catch (err) {
      // Best-effort: never let observability failures break agent runs
      this.logger.warn('Failed to log audit entry to observability service', {
        error: String(err),
        entryType: input.entryType,
      });
    }
  }
}
