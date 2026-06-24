import type { Database, AgentRecord, ConversationRecord, MessageRecord, ArtifactRecord } from './repository.js';

// ---- In-Memory implementation (for tests only) ----

export class InMemoryDB implements Database {
  agents: InMemoryAgentRepo;
  conversations: InMemoryConversationRepo;
  messages: InMemoryMessageRepo;
  artifacts: InMemoryArtifactRepo;

  constructor() {
    this.agents = new InMemoryAgentRepo();
    this.conversations = new InMemoryConversationRepo();
    this.messages = new InMemoryMessageRepo();
    this.artifacts = new InMemoryArtifactRepo();
  }

  clear(): void {
    this.agents.clear();
    this.conversations.clear();
    this.messages.clear();
    this.artifacts.clear();
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

export function createInMemoryDB(): InMemoryDB {
  return new InMemoryDB();
}
