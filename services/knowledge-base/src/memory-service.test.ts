import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryService } from './memory-service.js';
import { KnowledgeService } from './knowledge-service.js';
import { MockEmbeddingStrategy, MockChunker, InMemoryVectorStore } from './strategies/index.js';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  let knowledgeService: KnowledgeService;

  beforeEach(() => {
    knowledgeService = new KnowledgeService(
      new MockEmbeddingStrategy(8),
      new MockChunker(),
      new InMemoryVectorStore(),
    );
    memoryService = new MemoryService(knowledgeService);
  });

  describe('Working Memory (Layer 1)', () => {
    it('should store and retrieve working memory entries', () => {
      memoryService.setWorkingMemory('conv-1', [
        { key: 'current_step', value: 'planning' },
        { key: 'goal', value: 'build feature X' },
      ]);

      const entries = memoryService.getWorkingMemory('conv-1');
      expect(entries).toHaveLength(2);
      expect(entries[0]!.key).toBe('current_step');
      expect(entries[1]!.value).toBe('build feature X');
    });

    it('should return empty array for unknown conversation', () => {
      expect(memoryService.getWorkingMemory('no-such-conv')).toEqual([]);
    });

    it('should clear working memory for a conversation', () => {
      memoryService.setWorkingMemory('conv-1', [{ key: 'x', value: 1 }]);
      memoryService.clearWorkingMemory('conv-1');
      expect(memoryService.getWorkingMemory('conv-1')).toEqual([]);
    });

    it('should expire entries after TTL', () => {
      const fakeNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow);

      memoryService.setWorkingMemory('conv-1', [
        { key: 'ephemeral', value: 'data', ttl: 100 },
      ]);

      // Advance time past TTL
      vi.spyOn(Date, 'now').mockReturnValue(fakeNow + 200);

      const entries = memoryService.getWorkingMemory('conv-1');
      expect(entries).toEqual([]);
    });
  });

  describe('Short-term Memory (Layer 2)', () => {
    it('should store and recall short-term memory', async () => {
      await memoryService.storeShortTermMemory({
        conversationId: 'conv-1',
        messages: [
          { role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
          { role: 'assistant', content: 'Hi there!', timestamp: '2026-01-01T00:00:01Z' },
        ],
      });

      const results = await memoryService.recallShortTermMemory('conv-1');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.metadata).toHaveProperty('memoryType', 'short-term');
      expect(results[0]!.metadata).toHaveProperty('conversationId', 'conv-1');
    });
  });

  describe('Long-term Memory (Layer 3)', () => {
    it('should store and recall long-term memory', async () => {
      await memoryService.storeLongTermMemory({
        content: 'React is a JavaScript library for building UIs.',
        metadata: { topic: 'frontend' },
      });

      const results = await memoryService.recallLongTermMemory('React UI library');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.metadata).toHaveProperty('memoryType', 'long-term');
      expect(results[0]!.metadata).toHaveProperty('topic', 'frontend');
    });

    it('should filter long-term recall by memory type', async () => {
      await memoryService.storeLongTermMemory({
        content: 'TypeScript adds static typing to JavaScript.',
      });
      // Store a short-term memory that shouldn't appear in long-term recall
      await memoryService.storeShortTermMemory({
        conversationId: 'conv-x',
        messages: [{ role: 'user', content: 'Using TypeScript for safety.', timestamp: '2026-01-01T00:00:00Z' }],
      });

      const results = await memoryService.recallLongTermMemory('TypeScript');
      // Only long-term memory entries should be returned
      for (const r of results) {
        expect(r.metadata.memoryType).toBe('long-term');
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
