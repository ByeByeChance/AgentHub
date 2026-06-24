import type { DocumentRecord, SearchResult, SearchOptions } from '@agenthub/shared/db';
import type { VectorStoreBackend } from './vector-store.js';
import type { Database } from '@agenthub/shared/db';

/**
 * pgvector-backed vector store. Delegates to the shared Database interface.
 */
export class PgVectorStore implements VectorStoreBackend {
  readonly name = 'pgvector';

  constructor(private db: Database) {}

  async store(document: DocumentRecord): Promise<void> {
    await this.db.documents.insert(document);
  }

  async search(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    return this.db.documents.searchByVector(query, options);
  }

  async delete(id: string): Promise<void> {
    await this.db.documents.delete(id);
  }
}
