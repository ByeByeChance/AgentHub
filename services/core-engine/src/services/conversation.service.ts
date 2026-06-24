import type { Database, ConversationRecord, MessageRecord, MessagePart } from '@agenthub/shared/db';

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

export class ConversationService {
  constructor(private readonly db: Database) {}

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const record: ConversationRecord = {
      id, title: input.title ?? 'New Conversation',
      mode: input.mode ?? 'single', agentIds: input.agentIds,
      pinnedAt: null, createdAt: now,
    };
    await this.db.conversations.insert(record);
    return record;
  }

  async getConversation(id: string): Promise<Conversation | null> {
    return this.db.conversations.findById(id);
  }

  async listConversations(): Promise<Conversation[]> {
    return this.db.conversations.listAll();
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const record: MessageRecord = {
      id, conversationId: input.conversationId,
      role: input.role, parts: input.parts ?? [],
      status: 'streaming', createdAt: now,
    };
    await this.db.messages.insert(record);
    return record;
  }

  async getMessages(conversationId: string, limit = 50, offset = 0): Promise<Message[]> {
    const msgs = await this.db.messages.listByConversation(conversationId);
    return msgs.slice(offset, offset + limit);
  }

  async appendPart(messageId: string, part: MessagePart): Promise<void> {
    const existing = await this.db.messages.findById(messageId);
    if (!existing) throw new Error(`Message ${messageId} not found`);
    const parts = [...existing.parts, part];
    await this.db.messages.update(messageId, { parts });
  }

  async updateStatus(messageId: string, status: Message['status']): Promise<void> {
    await this.db.messages.update(messageId, { status });
  }
}
