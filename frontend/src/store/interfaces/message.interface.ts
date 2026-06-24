export interface MessagePart {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'artifact_ref';
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  artifactId?: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  status: 'streaming' | 'complete' | 'aborted' | 'failed';
  createdAt: string;
}
