import type { Database, AgentRecord, ConversationRecord, MessageRecord, ArtifactRecord, DocumentRecord, SearchResult } from './repository.interface.js';

// ---- In-Memory implementation (for tests only) ----

export class InMemoryDB implements Database {
  agents: InMemoryAgentRepo;
  conversations: InMemoryConversationRepo;
  messages: InMemoryMessageRepo;
  artifacts: InMemoryArtifactRepo;
  documents: InMemoryDocumentRepo;

  constructor() {
    this.agents = new InMemoryAgentRepo();
    this.conversations = new InMemoryConversationRepo();
    this.messages = new InMemoryMessageRepo();
    this.artifacts = new InMemoryArtifactRepo();
    this.documents = new InMemoryDocumentRepo();
  }

  clear(): void {
    this.agents.clear();
    this.conversations.clear();
    this.messages.clear();
    this.artifacts.clear();
    this.documents.clear();
  }
}

class InMemoryAgentRepo {
  private store = new Map<string, AgentRecord>();
  async insert(r: AgentRecord) { this.store.set(r.id, { ...r }); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async listAll() { return Array.from(this.store.values()); }
  async listByCategory(cat: string) { return Array.from(this.store.values()).filter(a => a.category === cat); }
  async search(q: string) {
    const l = q.toLowerCase();
    return Array.from(this.store.values()).filter(a => a.name.toLowerCase().includes(l) || a.description.toLowerCase().includes(l));
  }
  async count() { return this.store.size; }
  clear() { this.store.clear(); }
}

class InMemoryConversationRepo {
  private store = new Map<string, ConversationRecord>();
  async insert(r: ConversationRecord) { this.store.set(r.id, { ...r }); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async listAll() { return Array.from(this.store.values()); }
  clear() { this.store.clear(); }
}

class InMemoryMessageRepo {
  private store = new Map<string, MessageRecord>();
  async insert(r: MessageRecord) { this.store.set(r.id, { ...r }); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async listByConversation(convId: string) {
    return Array.from(this.store.values()).filter(m => m.conversationId === convId);
  }
  async update(id: string, updates: Partial<Pick<MessageRecord, 'parts' | 'status'>>) {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.store.set(id, updated);
    return updated;
  }
  async delete(id: string) { this.store.delete(id); }
  clear() { this.store.clear(); }
}

class InMemoryArtifactRepo {
  private store = new Map<string, ArtifactRecord>();
  async insert(r: ArtifactRecord) { this.store.set(r.id, { ...r }); }
  async findById(id: string) { return this.store.get(id) ?? null; }
  async listByConversation(convId: string) {
    return Array.from(this.store.values()).filter(a => a.conversationId === convId);
  }
  clear() { this.store.clear(); }
}

class InMemoryDocumentRepo {
  private store = new Map<string, DocumentRecord>();

  async insert(r: DocumentRecord) {
    this.store.set(r.id, { ...r, embedding: r.embedding ? [...r.embedding] : null });
  }

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }

  async delete(id: string) {
    this.store.delete(id);
  }

  async searchByVector(embedding: number[], options?: {
    topK?: number;
    threshold?: number;
    filters?: Record<string, unknown>;
  }): Promise<SearchResult[]> {
    const topK = options?.topK ?? 10;
    const threshold = options?.threshold ?? 0.0;
    const filters = options?.filters;

    const results: SearchResult[] = [];
    for (const doc of this.store.values()) {
      if (!doc.embedding) continue;

      // Apply metadata filters
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

      const score = cosineSimilarity(embedding, doc.embedding);
      if (score >= threshold) {
        results.push({ ...doc, embedding: doc.embedding ? [...doc.embedding] : null, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  clear() { this.store.clear(); }
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

export function createInMemoryDB(): InMemoryDB {
  return new InMemoryDB();
}
