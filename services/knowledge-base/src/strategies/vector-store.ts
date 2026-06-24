import type { DocumentRecord, SearchResult, SearchOptions } from '@agenthub/shared/db';

/**
 * Strategy interface for vector storage backends.
 * Supports pgvector, FAISS, ChromaDB, and other vector stores.
 */
export interface VectorStoreBackend {
  readonly name: string;

  /** Store a document with its embedding */
  store(document: DocumentRecord): Promise<void>;

  /** Search for similar documents by embedding vector */
  search(query: number[], options?: SearchOptions): Promise<SearchResult[]>;

  /** Delete a document by ID */
  delete(id: string): Promise<void>;
}
