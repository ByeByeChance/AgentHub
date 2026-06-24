import { randomUUID } from 'node:crypto';
import type { EmbeddingStrategy, ChunkingStrategy, VectorStoreBackend } from './strategies/index.js';
import type { DocumentRecord, SearchResult, SearchOptions } from '@agenthub/shared/db';
import { addDocumentSchema, searchQuerySchema } from './validation/knowledge-schemas.js';
import type { AddDocumentInput, SearchQueryInput } from './interfaces/knowledge.interface.js';

// ---- KnowledgeService ----
export class KnowledgeService {
  constructor(
    private embeddingStrategy: EmbeddingStrategy,
    private chunkingStrategy: ChunkingStrategy,
    private vectorStore: VectorStoreBackend,
  ) {}

  async addDocument(input: AddDocumentInput): Promise<{ documentIds: string[]; chunkCount: number }> {
    const parsed = addDocumentSchema.parse(input);

    // 1. Chunk the text
    const chunks = await this.chunkingStrategy.chunk(parsed.text);

    // 2. Embed all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await this.embeddingStrategy.embedBatch(chunkTexts);

    // 3. Store each chunk as a document
    const documentIds: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i]!;
      const docId = randomUUID();

      const doc: DocumentRecord = {
        id: docId,
        content: chunk.text,
        embedding,
        metadata: {
          ...parsed.metadata,
          chunkIndex: chunk.index,
          parentDocumentId: parsed.parentDocumentId ?? null,
        },
        source: parsed.source ?? null,
        createdAt: new Date().toISOString(),
      };

      await this.vectorStore.store(doc);
      documentIds.push(docId);
    }

    return { documentIds, chunkCount: chunks.length };
  }

  async search(input: SearchQueryInput): Promise<SearchResult[]> {
    const parsed = searchQuerySchema.parse(input);

    // 1. Embed the query
    const queryEmbedding = await this.embeddingStrategy.embed(parsed.query);

    // 2. Search vector store
    const options: SearchOptions = {
      topK: parsed.topK,
      threshold: parsed.threshold,
      filters: parsed.filters,
    };

    return this.vectorStore.search(queryEmbedding, options);
  }

  async deleteDocument(id: string): Promise<void> {
    await this.vectorStore.delete(id);
  }
}
