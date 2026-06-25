import type { ConversationService } from '../conversation.service.js';
import type { AgentRegistry } from '../agent-registry.js';
import type { AgentRunner } from '../agent-runner.js';
import type { AgentAdapter } from '@agenthub/shared/adapter';
import type { TransportStrategy } from '@agenthub/shared/transport';
import type { ToolExecutor } from '../tool-executor.js';
import type { WorkspaceService } from './workspace.interface.js';
import type { EventBus } from '@agenthub/shared/event-bus';
import type { EventSource } from '@agenthub/contracts';
import type { Database } from '@agenthub/shared/db';
import type { TokenRecorderLike, AuditLoggerLike } from './agent-runner.interface.js';

export interface ConversationRouteDeps {
  conversationService: ConversationService;
  agentRegistry: AgentRegistry;
  agentRunner: AgentRunner;
  toolExecutor: ToolExecutor;
  workspaceService: WorkspaceService;
  eventBus: EventBus;
  source: EventSource;
  db: Database;
  adapterFactory: () => AgentAdapter;
  transport: TransportStrategy;
  tokenRecorder: TokenRecorderLike;
  auditLogger: AuditLoggerLike;
}
