import type { ChunkingStrategy, Chunk, ChunkOptions } from './chunking-strategy.interface.js';

const DEFAULT_MAX_CHUNK_SIZE = 512;
const DEFAULT_OVERLAP = 50;
const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '。', ' '];

/**
 * Recursive text splitter — tries to split by the largest separator first,
 * then falls back to smaller separators, and finally character-level split.
 */
export class RecursiveChunker implements ChunkingStrategy {
  readonly name = 'recursive';

  async chunk(text: string, options?: ChunkOptions): Promise<Chunk[]> {
    const maxSize = options?.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
    const overlap = options?.overlap ?? DEFAULT_OVERLAP;
    const chunks: Chunk[] = [];
    const splits = this.splitRecursive(text, DEFAULT_SEPARATORS, maxSize, overlap);
    for (let i = 0; i < splits.length; i++) {
      chunks.push({
        text: splits[i]!,
        index: i,
        metadata: { charLength: splits[i]!.length },
      });
    }
    return chunks;
  }

  private splitRecursive(
    text: string,
    separators: string[],
    maxSize: number,
    overlap: number,
  ): string[] {
    if (text.length <= maxSize) return [text];

    const [sep, ...rest] = separators;
    if (!sep) {
      // Final fallback: split by character
      return this.splitByCharacter(text, maxSize, overlap);
    }

    const parts = text.split(sep);
    const result: string[] = [];

    for (const part of parts) {
      if (part.length <= maxSize) {
        if (part.length > 0) result.push(part);
      } else {
        // Recurse with remaining separators
        result.push(...this.splitRecursive(part, rest, maxSize, overlap));
      }
    }

    return result;
  }

  private splitByCharacter(text: string, maxSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + maxSize, text.length);
      chunks.push(text.slice(start, end));
      start += maxSize - overlap;
    }
    return chunks;
  }
}
