import type { WorkspaceService } from './workspace.interface.js';
import type { Database } from '@agenthub/shared/db';

export interface ToolContext {
  conversationId: string;
  workspaceService: WorkspaceService;
  db: Database;
  agentId: string;
  signal: AbortSignal & { aborted: boolean };
}

export interface ToolRegistration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<unknown>;
}
