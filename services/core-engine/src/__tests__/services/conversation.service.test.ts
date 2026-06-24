import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationService } from '../../services/conversation.service.js';
import { InMemoryDB } from '@agenthub/shared/db';
import type { Database } from '@agenthub/shared/db';

describe('ConversationService', () => {
  let service: ConversationService;
  let db: Database;

  beforeEach(() => {
    db = new InMemoryDB();
    service = new ConversationService(db);
  });

  it('should create a conversation', async () => {
    const conv = await service.createConversation({ agentIds: ['a1'] });
    expect(conv.id).toBeDefined();
    expect(conv.title).toBe('New Conversation');
  });

  it('should create and retrieve messages', async () => {
    const conv = await service.createConversation({ agentIds: ['a1'] });
    const msg = await service.createMessage({ conversationId: conv.id, role: 'user', parts: [{ type: 'text', content: 'hello' }] });
    expect(msg.status).toBe('streaming');
    expect(msg.parts).toHaveLength(1);
  });

  it('should append parts', async () => {
    const conv = await service.createConversation({ agentIds: ['a1'] });
    const msg = await service.createMessage({ conversationId: conv.id, role: 'assistant' });
    await service.appendPart(msg.id, { type: 'text', content: 'Hello ' });
    await service.appendPart(msg.id, { type: 'text', content: 'World' });
    const msgs = await service.getMessages(conv.id);
    expect(msgs[0]!.parts).toHaveLength(2);
  });

  it('should update status', async () => {
    const conv = await service.createConversation({ agentIds: ['a1'] });
    const msg = await service.createMessage({ conversationId: conv.id, role: 'assistant' });
    await service.updateStatus(msg.id, 'complete');
    const msgs = await service.getMessages(conv.id);
    expect(msgs[0]!.status).toBe('complete');
  });

  it('should list conversations', async () => {
    await service.createConversation({ agentIds: ['a1'] });
    await service.createConversation({ agentIds: ['a2'] });
    expect(await service.listConversations()).toHaveLength(2);
  });
});
