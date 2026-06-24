import type { ChunkingStrategy, Chunk, ChunkOptions } from './interfaces/chunking-strategy.interface.js';

/**
 * Mock chunker for tests — splits by sentences or returns text as-is.
 */
export class MockChunker implements ChunkingStrategy {
  readonly name = 'mock';

  async chunk(text: string, _options?: ChunkOptions): Promise<Chunk[]> {
    // Split by sentences for realistic chunks
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.map((s, i) => ({
      text: s.trim(),
      index: i,
      metadata: { charLength: s.length },
    }));
  }
}
