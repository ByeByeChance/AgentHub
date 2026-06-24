import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryDB } from './connection.js';
import type { Database } from './repository.js';

describe('InMemoryDB', () => {
  let db: Database;

  beforeEach(() => { db = createInMemoryDB(); });

  describe('agents', () => {
    it('should insert and find by id', async () => {
      await db.agents.insert({ id: 'a1', name: 'Test', emoji: '🤖', description: 'Desc', category: 'eng', systemPrompt: 'SP', adapterName: 'ds', modelId: 'm1', toolNames: [], isBuiltin: true, isOrchestrator: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
      const a = await db.agents.findById('a1');
      expect(a).toBeDefined();
      expect(a!.name).toBe('Test');
    });

    it('should list by category', async () => {
      await db.agents.insert({ id: 'a1', name: 'E', category: 'eng' } as never);
      await db.agents.insert({ id: 'a2', name: 'M', category: 'mkt' } as never);
      const eng = await db.agents.listByCategory('eng');
      expect(eng).toHaveLength(1);
    });

    it('should search by name', async () => {
      await db.agents.insert({ id: 'a1', name: 'Frontend Dev', description: 'React', category: 'eng' } as never);
      const r = await db.agents.search('react');
      expect(r).toHaveLength(1);
    });

    it('should count', async () => {
      expect(await db.agents.count()).toBe(0);
      await db.agents.insert({ id: 'a1', name: 'A', category: 'eng' } as never);
      expect(await db.agents.count()).toBe(1);
    });
  });

  describe('messages', () => {
    it('should append parts via update', async () => {
      await db.messages.insert({ id: 'm1', conversationId: 'c1', role: 'assistant', parts: [], status: 'streaming', createdAt: 'now' });
      await db.messages.update('m1', { parts: [{ type: 'text', content: 'hi' }] });
      const m = await db.messages.findById('m1');
      expect(m!.parts).toHaveLength(1);
    });
  });

  describe('artifacts', () => {
    it('should list by conversation', async () => {
      await db.artifacts.insert({ id: 'art1', conversationId: 'c1', type: 'code', title: 'a.ts', content: {}, version: 1, parentArtifactId: null, createdAt: 'now' });
      const arts = await db.artifacts.listByConversation('c1');
      expect(arts).toHaveLength(1);
    });
  });
});
