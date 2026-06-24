/**
 * Strategy interface for text-to-vector embedding.
 * Must be implemented by all embedding providers (DeepSeek, OpenAI, local BGE-M3, etc.)
 */
export interface EmbeddingStrategy {
  readonly name: string;
  readonly dimensions: number;

  /** Embed a single text into a vector */
  embed(text: string): Promise<number[]>;

  /** Embed multiple texts in a single batch call (preferred for efficiency) */
  embedBatch(texts: string[]): Promise<number[][]>;
}
