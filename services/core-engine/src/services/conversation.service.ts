import type { Database, ConversationRecord, MessageRecord, MessagePart } from '@agenthub/shared/db';
import type { Conversation, Message, CreateConversationInput, CreateMessageInput } from './interfaces/conversation.interface.js';

export class ConversationService {
  constructor(private readonly db: Database) {}

  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const record: ConversationRecord = {
        id, title: input.title ?? 'New Conversation',
        mode: input.mode ?? 'single', agentIds: input.agentIds,
        pinnedAt: null, createdAt: now,
      };
      await this.db.conversations.insert(record);
      return record;
    } catch (err) {
      throw new Error(`Failed to create conversation: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async getConversation(id: string): Promise<Conversation | null> {
    try {
      return this.db.conversations.findById(id);
    } catch (err) {
      throw new Error(`Failed to get conversation '${id}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async listConversations(): Promise<Conversation[]> {
    try {
      return this.db.conversations.listAll();
    } catch (err) {
      throw new Error(`Failed to list conversations: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    try {
      const id = input.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const record: MessageRecord = {
        id, conversationId: input.conversationId,
        role: input.role, parts: input.parts ?? [],
        status: 'streaming', createdAt: now,
      };
      await this.db.messages.insert(record);
      return record;
    } catch (err) {
      throw new Error(`Failed to create message in conversation '${input.conversationId}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async getMessages(conversationId: string, limit = 50, offset = 0): Promise<Message[]> {
    try {
      const msgs = await this.db.messages.listByConversation(conversationId);
      return msgs.slice(offset, offset + limit);
    } catch (err) {
      throw new Error(`Failed to get messages for conversation '${conversationId}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async appendPart(messageId: string, part: MessagePart): Promise<void> {
    try {
      const existing = await this.db.messages.findById(messageId);
      if (!existing) throw new Error(`Message ${messageId} not found`);
      const parts = [...existing.parts, part];
      await this.db.messages.update(messageId, { parts });
    } catch (err) {
      throw new Error(`Failed to append part to message '${messageId}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async updateStatus(messageId: string, status: Message['status']): Promise<void> {
    try {
      await this.db.messages.update(messageId, { status });
    } catch (err) {
      throw new Error(`Failed to update status for message '${messageId}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.db.messages.delete(messageId);
    } catch (err) {
      throw new Error(`Failed to delete message '${messageId}': ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
  }
}
