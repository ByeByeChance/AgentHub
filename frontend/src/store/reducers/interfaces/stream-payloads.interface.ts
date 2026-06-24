// Payload type definitions for each event type

export interface AgentRunStartPayload {
  agentId: string;
  agentName: string;
  conversationId: string;
  messageId: string;
}

export interface AgentRunCompletePayload {
  agentId: string;
  conversationId: string;
  messageId: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AgentRunFailedPayload {
  agentId: string;
  conversationId: string;
  messageId: string;
  error: string;
}

export interface AgentRunAbortedPayload {
  agentId: string;
  conversationId: string;
  messageId: string;
}

export interface MessagePartTextPayload {
  messageId: string;
  content: string;
}

export interface MessagePartThinkingPayload {
  messageId: string;
  content: string;
}

export interface MessagePartToolUsePayload {
  messageId: string;
  toolCallId: string;
  toolName: string;
  phase?: string;
}

export interface MessagePartToolResultPayload {
  messageId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError: boolean;
}

export interface ToolCallPayload {
  conversationId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ToolResultPayload {
  conversationId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError: boolean;
}

export interface ArtifactCreatedPayload {
  id: string;
  conversationId: string;
  type: 'web_app' | 'document' | 'code' | 'image';
  title: string;
  content: unknown;
}

export interface ArtifactUpdatedPayload {
  id: string;
  content: unknown;
  version: number;
}
