import type { AgentAdapter, AgentConfig, LLMMessage } from '@agenthub/shared/adapter';
import type { EventBus } from '@agenthub/shared/event-bus';
import type { EventSource } from '@agenthub/contracts';
import type { ToolExecutor } from '../tool-executor.js';
import type { ConversationService } from '../conversation.service.js';
import type { WorkspaceService } from './workspace.interface.js';
import type { Database } from '@agenthub/shared/db';
import type { Logger } from '@agenthub/shared/logging';

/**
 * Minimal interface for token recording to avoid coupling to observability service.
 */
export interface TokenRecorderLike {
  record(input: {
    model: string;
    tokensIn: number;
    tokensOut: number;
    conversationId?: string;
    agentId?: string;
  }): Promise<unknown>;
}

/**
 * Minimal interface for audit logging to avoid coupling to observability service.
 */
export interface AuditLoggerLike {
  log(input: {
    entryType: string;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface AgentRunInput {
  agentConfig: AgentConfig;
  conversationId: string;
  messages: LLMMessage[];
  toolExecutor: ToolExecutor;
  adapter: AgentAdapter;
  eventBus: EventBus;
  source: EventSource;
  conversationService: ConversationService;
  workspaceService: WorkspaceService;
  db: Database;
  signal: AbortSignal & { aborted: boolean };
  maxToolRounds?: number;
  logger: Logger;
  tokenRecorder?: TokenRecorderLike;
  auditLogger?: AuditLoggerLike;
}
