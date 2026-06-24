import type { MessagePart } from './schema.js';

// ---- Agent Repository ----
export interface AgentRecord {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  systemPrompt: string;
  adapterName: string;
  modelId: string;
  toolNames: string[];
  isBuiltin: boolean;
  isOrchestrator: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRepository {
  insert(agent: AgentRecord): Promise<void>;
  findById(id: string): Promise<AgentRecord | null>;
  listAll(): Promise<AgentRecord[]>;
  listByCategory(category: string): Promise<AgentRecord[]>;
  search(query: string): Promise<AgentRecord[]>;
  count(): Promise<number>;
}

// ---- Conversation Repository ----
export interface ConversationRecord {
  id: string;
  title: string;
  mode: 'single' | 'group';
  agentIds: string[];
  pinnedAt: string | null;
  createdAt: string;
}

export interface ConversationRepository {
  insert(conv: ConversationRecord): Promise<void>;
  findById(id: string): Promise<ConversationRecord | null>;
  listAll(): Promise<ConversationRecord[]>;
}

// ---- Message Repository ----
export interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  status: 'streaming' | 'complete' | 'aborted' | 'failed';
  createdAt: string;
}

export interface MessageRepository {
  insert(msg: MessageRecord): Promise<void>;
  findById(id: string): Promise<MessageRecord | null>;
  listByConversation(conversationId: string): Promise<MessageRecord[]>;
  update(id: string, updates: Partial<Pick<MessageRecord, 'parts' | 'status'>>): Promise<MessageRecord | null>;
}

// ---- Artifact Repository ----
export interface ArtifactRecord {
  id: string;
  conversationId: string;
  type: 'web_app' | 'document' | 'code' | 'image';
  title: string;
  content: unknown;
  version: number;
  parentArtifactId: string | null;
  createdAt: string;
}

export interface ArtifactRepository {
  insert(artifact: ArtifactRecord): Promise<void>;
  findById(id: string): Promise<ArtifactRecord | null>;
  listByConversation(conversationId: string): Promise<ArtifactRecord[]>;
}

// ---- Combined Database interface ----
export interface Database {
  agents: AgentRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  artifacts: ArtifactRepository;
}
