export interface Chunk {
  text: string;
  index: number;
  metadata?: Record<string, unknown>;
}

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
  separator?: string;
}

/**
 * Strategy interface for splitting text into manageable chunks
 * before embedding. Different strategies suit different content types.
 */
export interface ChunkingStrategy {
  readonly name: string;

  /** Split text into chunks */
  chunk(text: string, options?: ChunkOptions): Promise<Chunk[]>;
}
