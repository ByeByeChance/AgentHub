import type { DocumentRecord, SearchResult, SearchOptions } from '@agenthub/shared/db';
import type { VectorStoreBackend } from './vector-store.interface.js';

/**
 * In-memory vector store for tests. Uses cosine similarity for search.
 */
export class InMemoryVectorStore implements VectorStoreBackend {
  readonly name = 'inmemory';
  private documents = new Map<string, DocumentRecord>();

  async store(document: DocumentRecord): Promise<void> {
    this.documents.set(document.id, { ...document, embedding: document.embedding ? [...document.embedding] : null });
  }

  async search(query: number[], options?: SearchOptions): Promise<SearchResult[]> {
    const topK = options?.topK ?? 10;
    const threshold = options?.threshold ?? 0.0;
    const filters = options?.filters;

    const results: SearchResult[] = [];
    for (const doc of this.documents.values()) {
      if (!doc.embedding) continue;

      if (filters) {
        let match = true;
        for (const [key, value] of Object.entries(filters)) {
          if (doc.metadata[key] !== value) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      const score = cosineSimilarity(query, doc.embedding);
      if (score >= threshold) {
        results.push({ ...doc, embedding: doc.embedding ? [...doc.embedding] : null, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async delete(id: string): Promise<void> {
    this.documents.delete(id);
  }

  clear(): void {
    this.documents.clear();
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
