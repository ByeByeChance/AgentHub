import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeService, addDocumentSchema, searchQuerySchema } from './knowledge-service.js';
import { MockEmbeddingStrategy, MockChunker, InMemoryVectorStore } from './strategies/index.js';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let vectorStore: InMemoryVectorStore;

  beforeEach(() => {
    vectorStore = new InMemoryVectorStore();
    service = new KnowledgeService(
      new MockEmbeddingStrategy(8),
      new MockChunker(),
      vectorStore,
    );
  });

  describe('addDocument', () => {
    it('should add a document: chunk, embed, and store', async () => {
      const result = await service.addDocument({
        text: 'This is a test document. It has two sentences.',
      });
      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.documentIds).toHaveLength(result.chunkCount);
    });

    it('should handle single-sentence text', async () => {
      const result = await service.addDocument({ text: 'Hello world' });
      expect(result.chunkCount).toBe(1);
      expect(result.documentIds).toHaveLength(1);
    });

    it('should store metadata on chunks', async () => {
      await service.addDocument({
        text: 'AI is transforming software.',
        metadata: { topic: 'ai' },
        source: 'test-source',
      });

      const results = await service.search({ query: 'AI' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.metadata).toHaveProperty('topic', 'ai');
    });
  });

  describe('search', () => {
    it('should search and return scored results', async () => {
      await service.addDocument({ text: 'Machine learning is powerful for data analysis.' });
      await service.addDocument({ text: 'Banana bread recipe with walnuts and cinnamon.' });

      const results = await service.search({ query: 'machine learning and AI' });
      expect(results.length).toBeGreaterThan(0);
      // Verify results are sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
      }
      expect(typeof results[0]!.score).toBe('number');
    });

    it('should handle empty vector store gracefully', async () => {
      const results = await service.search({ query: 'nothing here' });
      expect(results).toEqual([]);
    });

    it('should respect topK parameter', async () => {
      await service.addDocument({ text: 'Doc 1 about cats.' });
      await service.addDocument({ text: 'Doc 2 about cats and dogs.' });
      await service.addDocument({ text: 'Doc 3 about cats and birds.' });

      const results = await service.search({ query: 'cats', topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document by ID', async () => {
      const { documentIds } = await service.addDocument({ text: 'To be deleted.' });
      await service.deleteDocument(documentIds[0]!);

      const results = await service.search({ query: 'deleted' });
      expect(results).toEqual([]);
    });
  });

  describe('Zod validation', () => {
    it('should reject empty text for addDocument', () => {
      expect(() => addDocumentSchema.parse({ text: '' })).toThrow();
    });

    it('should reject empty query for search', () => {
      expect(() => searchQuerySchema.parse({ query: '' })).toThrow();
    });

    it('should require positive topK', () => {
      expect(() => searchQuerySchema.parse({ query: 'x', topK: 0 })).toThrow();
    });
  });
});
