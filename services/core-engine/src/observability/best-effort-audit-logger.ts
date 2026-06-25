import type { AuditLoggerLike } from '../services/interfaces/agent-runner.interface.js';
import type { Logger } from '@agenthub/shared/logging';

/**
 * Best-effort audit logger that writes audit entries via the structured logger.
 *
 * This is a lightweight, always-available implementation that satisfies the
 * AuditLoggerLike interface. It does NOT implement SHA-256 chain verification
 * (that requires a persistent database). When the observability service
 * integration is prioritized, replace with a database-backed or HTTP-client
 * implementation.
 */
export class BestEffortAuditLogger implements AuditLoggerLike {
  constructor(private logger: Logger) {}

  async log(input: {
    entryType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    this.logger.info('Audit entry logged', {
      entryType: input.entryType,
      payload: input.payload,
    });
  }
}
