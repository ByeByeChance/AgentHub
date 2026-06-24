import type { ToolDefinition, ToolResult } from '@agenthub/shared/adapter';
import type { WorkspaceService } from './workspace.service.js';
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

export class ToolExecutor {
  private tools = new Map<string, ToolRegistration>();

  constructor() { this.registerBuiltInTools(); }

  private registerBuiltInTools(): void {
    this.register({
      name: 'fs_read', description: 'Read a file from the workspace',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Relative path to the file' } }, required: ['path'] },
      handler: async (args, ctx) => ctx.workspaceService.read(args['path'] as string),
    });

    this.register({
      name: 'fs_write', description: 'Write content to a file in the workspace',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
      handler: async (args, ctx) => {
        await ctx.workspaceService.write(args['path'] as string, args['content'] as string);
        return `File written: ${args['path']}`;
      },
    });

    this.register({
      name: 'bash', description: 'Execute a bash command in the workspace',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' }, platform: { type: 'string', enum: ['posix', 'windows'] } },
        required: ['command'],
      },
      handler: async (args, ctx) => {
        const result = await ctx.workspaceService.exec(args['command'] as string, (args['platform'] as 'posix') ?? 'posix');
        return JSON.stringify({ stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode });
      },
    });

    this.register({
      name: 'write_artifact', description: 'Create a persistent artifact (file, document, web app)',
      parameters: {
        type: 'object',
        properties: { type: { type: 'string', enum: ['web_app', 'document', 'code', 'image'] }, title: { type: 'string' }, content: { type: 'object' } },
        required: ['type', 'title', 'content'],
      },
      handler: async (args, ctx) => {
        const id = crypto.randomUUID();
        await ctx.db.artifacts.insert({
          id, conversationId: ctx.conversationId,
          type: args['type'] as 'web_app' | 'document' | 'code' | 'image',
          title: args['title'] as string, content: args['content'] as unknown,
          version: 1, parentArtifactId: null,
          createdAt: new Date().toISOString(),
        });
        return JSON.stringify({ artifactId: id, type: args['type'], title: args['title'] });
      },
    });

    this.register({
      name: 'ask_user', description: 'Ask the user a question when more information is needed',
      parameters: {
        type: 'object',
        properties: { question: { type: 'string' }, context: { type: 'string' } },
        required: ['question'],
      },
      handler: async (args, _ctx) => {
        return JSON.stringify({ question: args['question'], context: args['context'] ?? null, status: 'pending_user_response' });
      },
    });
  }

  register(tool: ToolRegistration): void { this.tools.set(tool.name, tool); }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({ name: t.name, description: t.description, parameters: t.parameters }));
  }

  async execute(name: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { toolCallId: `unknown_${name}`, name, result: `Unknown tool: ${name}`, isError: true };
    try {
      if (context.signal.aborted) return { toolCallId: `aborted_${name}`, name, result: 'Aborted', isError: true };
      const result = await tool.handler(args, context);
      return { toolCallId: `result_${name}_${Date.now()}`, name, result, isError: false };
    } catch (err) {
      return { toolCallId: `error_${name}_${Date.now()}`, name, result: err instanceof Error ? err.message : String(err), isError: true };
    }
  }
}
