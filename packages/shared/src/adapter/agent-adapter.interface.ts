// ---- Message types for LLM interaction ----
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

// ---- Tool definition for LLM function calling ----
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

// ---- Stream chunks emitted by adapter ----
export type StreamChunk =
  | { type: 'text_delta'; content: string }
  | { type: 'thinking_delta'; content: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | {
      type: 'tool_use_delta';
      id: string;
      argumentDelta: string;
    }
  | {
      type: 'tool_use_end';
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: 'done';
      finishReason: 'stop' | 'tool_calls' | 'length';
      usage: { promptTokens: number; completionTokens: number };
    };

// ---- Tool result passed back to LLM ----
export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  isError: boolean;
}

// ---- Agent configuration ----
export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  adapterName: string;
  modelId: string;
  toolNames: string[];
}

// ---- The core AgentAdapter interface ----
export interface AgentAdapter {
  readonly name: string;

  streamChat(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    signal: AbortSignal & { aborted: boolean },
  ): AsyncGenerator<StreamChunk>;

  buildSystemPrompt(config: AgentConfig): string;
}
