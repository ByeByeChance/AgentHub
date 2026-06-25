import type { TokenRecorderLike } from '../services/interfaces/agent-runner.interface.js';
import type { Logger } from '@agenthub/shared/logging';

/**
 * HTTP-client TokenRecorder that POSTs to the observability service API.
 *
 * Sends token usage records to POST /api/obs/tokens on the observability
 * service. Falls back to structured logging when the HTTP request fails
 * (the observability service being unavailable must not break agent runs).
 */
export class HttpTokenRecorder implements TokenRecorderLike {
  private readonly observabilityUrl: string;

  constructor(
    private logger: Logger,
    observabilityUrl?: string,
  ) {
    this.observabilityUrl = (observabilityUrl ?? process.env.OBSERVABILITY_URL ?? 'http://localhost:3004').replace(/\/$/, '');
  }

  async record(input: {
    model: string;
    tokensIn: number;
    tokensOut: number;
    conversationId?: string;
    agentId?: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.observabilityUrl}/api/obs/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.warn('Observability token record returned non-ok status', {
          status: response.status,
          model: input.model,
        });
      }
    } catch (err) {
      // Best-effort: never let observability failures break agent runs
      this.logger.warn('Failed to record token usage to observability service', {
        error: String(err),
        model: input.model,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
      });
    }
  }
}
