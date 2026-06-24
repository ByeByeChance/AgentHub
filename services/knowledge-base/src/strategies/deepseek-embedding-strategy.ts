import OpenAI from 'openai';
import type { EmbeddingStrategy } from './interfaces/embedding-strategy.interface.js';

/**
 * DeepSeek embedding strategy using OpenAI-compatible API.
 * Uses the deepseek-text-embedding model (1536 dimensions).
 */
export class DeepSeekEmbeddingStrategy implements EmbeddingStrategy {
  readonly name = 'deepseek';
  readonly dimensions = 1536;
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!key) {
      throw new Error('DEEPSEEK_API_KEY is required for DeepSeekEmbeddingStrategy');
    }
    this.client = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.embedBatch([text]);
    return result[0]!;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'deepseek-text-embedding',
      input: texts,
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
