export interface WorkingMemoryEntry {
  key: string;
  value: unknown;
  ttl?: number; // TTL in ms (undefined = no expiry)
  createdAt: number;
}

export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ShortTermMemoryInput {
  conversationId: string;
  messages: MemoryMessage[];
}

export interface LongTermMemoryInput {
  content: string;
  metadata?: Record<string, unknown>;
  conversationId?: string;
}
