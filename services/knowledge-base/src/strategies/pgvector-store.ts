import type { DocumentRecord, SearchResult, SearchOptions, DocumentRepository } from '@agenthub/shared/db';
import type { VectorStoreBackend } from './interfaces/vector-store.interface.js';

/**
 * pgvector-backed vector store. Uses a DocumentRepository directly
 * rather than the full shared Database interface, so the Knowledge Base
 * service fully owns its storage surface.
 */
export class PgVectorStore implements VectorStoreBackend {
  readonly name = 'pgvector';

  constructor(private documents: DocumentRepository) {}

  async store(document: DocumentRecord): Promise<void> {
    await this.documents.insert(document);
  }

  async search(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    return this.documents.searchByVector(query, options);
  }

  async delete(id: string): Promise<void> {
    await this.documents.delete(id);
  }
}
