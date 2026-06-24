import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryDB } from '../../db/connection.js';
import type { Database } from '../../db/repository.interface.js';

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

  describe('documents', () => {
    it('should insert and find by id', async () => {
      await db.documents.insert({
        id: 'd1', content: 'Hello world', embedding: [0.1, 0.2, 0.3],
        metadata: { topic: 'greeting' }, source: 'test', createdAt: 'now',
      });
      const doc = await db.documents.findById('d1');
      expect(doc).toBeDefined();
      expect(doc!.content).toBe('Hello world');
      expect(doc!.metadata).toEqual({ topic: 'greeting' });
    });

    it('should delete document', async () => {
      await db.documents.insert({
        id: 'd2', content: 'Temp', embedding: [0.5], metadata: {}, source: null, createdAt: 'now',
      });
      await db.documents.delete('d2');
      const doc = await db.documents.findById('d2');
      expect(doc).toBeNull();
    });

    it('should search by vector with cosine similarity', async () => {
      await db.documents.insert({
        id: 'd3', content: 'AI and machine learning',
        embedding: [1.0, 0.0, 0.0], metadata: {}, source: null, createdAt: 'now',
      });
      await db.documents.insert({
        id: 'd4', content: 'Banana recipes',
        embedding: [0.0, 1.0, 0.0], metadata: {}, source: null, createdAt: 'now',
      });
      await db.documents.insert({
        id: 'd5', content: 'Deep learning intro',
        embedding: [0.9, 0.1, 0.0], metadata: { topic: 'ai' }, source: null, createdAt: 'now',
      });

      const results = await db.documents.searchByVector([1.0, 0.0, 0.0], { topK: 2 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.id).toBe('d3'); // Most similar to [1,0,0]
      expect(results[0]!.score).toBeGreaterThan(0.9);
    });

    it('should apply metadata filters in search', async () => {
      await db.documents.insert({
        id: 'd6', content: 'AI article',
        embedding: [1.0, 0.0, 0.0], metadata: { topic: 'ai' }, source: null, createdAt: 'now',
      });
      await db.documents.insert({
        id: 'd7', content: 'Cooking article',
        embedding: [1.0, 0.0, 0.0], metadata: { topic: 'cooking' }, source: null, createdAt: 'now',
      });

      const results = await db.documents.searchByVector(
        [1.0, 0.0, 0.0],
        { filters: { topic: 'ai' } },
      );
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('d6');
    });

    it('should respect threshold in search', async () => {
      await db.documents.insert({
        id: 'd8', content: 'Similar content',
        embedding: [1.0, 0.0, 0.0], metadata: {}, source: null, createdAt: 'now',
      });
      await db.documents.insert({
        id: 'd9', content: 'Different content',
        embedding: [-1.0, 0.0, 0.0], metadata: {}, source: null, createdAt: 'now',
      });

      const results = await db.documents.searchByVector(
        [1.0, 0.0, 0.0],
        { threshold: 0.9 },
      );
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('d8');
    });
  });
});
