import type { TokenRecorderLike } from '../services/interfaces/agent-runner.interface.js';
import type { Logger } from '@agenthub/shared/logging';

/**
 * Best-effort token recorder that logs token usage via the structured logger.
 *
 * This is a lightweight, always-available implementation that satisfies the
 * TokenRecorderLike interface. When the observability service integration is
 * prioritized, replace with an HTTP client that POSTs to the observability API
 * or a shared database-backed implementation.
 */
export class BestEffortTokenRecorder implements TokenRecorderLike {
  constructor(private logger: Logger) {}

  async record(input: {
    model: string;
    tokensIn: number;
    tokensOut: number;
    conversationId?: string;
    agentId?: string;
  }): Promise<void> {
    this.logger.info('Token usage recorded', {
      model: input.model,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      conversationId: input.conversationId,
      agentId: input.agentId,
    });
  }
}
