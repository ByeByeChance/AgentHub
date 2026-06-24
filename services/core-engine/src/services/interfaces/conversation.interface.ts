import type { MessagePart } from '@agenthub/shared/db';

export interface Conversation {
  id: string;
  title: string;
  mode: 'single' | 'group';
  agentIds: string[];
  pinnedAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  status: 'streaming' | 'complete' | 'aborted' | 'failed';
  createdAt: string;
}

export interface CreateConversationInput {
  title?: string;
  mode?: 'single' | 'group';
  agentIds: string[];
}

export interface CreateMessageInput {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  parts?: MessagePart[];
  id?: string;
}
