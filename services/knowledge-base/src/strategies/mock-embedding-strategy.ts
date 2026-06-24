import { createHash } from 'node:crypto';
import type { EmbeddingStrategy } from './embedding-strategy.js';

/**
 * Mock embedding strategy that produces deterministic embeddings from text hash.
 * Used in tests to avoid real API calls.
 */
export class MockEmbeddingStrategy implements EmbeddingStrategy {
  readonly name = 'mock';
  readonly dimensions: number;

  constructor(dimensions = 8) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    return this.hashToEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.hashToEmbedding(t));
  }

  private hashToEmbedding(text: string): number[] {
    const hash = createHash('sha256').update(text).digest('hex');
    const embedding: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      // Take 2 hex chars at a time, parse as number between 0-255, normalize to [0, 1]
      const byteHex = hash.substring((i * 2) % hash.length, (i * 2 + 2) % hash.length || 2);
      embedding.push(parseInt(byteHex, 16) / 255);
    }
    return embedding;
  }
}
