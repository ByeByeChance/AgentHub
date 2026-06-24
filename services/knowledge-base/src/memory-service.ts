import { z } from 'zod';
import type { KnowledgeService } from './knowledge-service.js';
import type { SearchResult } from '@agenthub/shared/db';

// ---- Types ----
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

// ---- Zod Schemas ----
export const shortTermSchema = z.object({
  conversationId: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string(),
  })),
});

export const workingMemorySchema = z.object({
  conversationId: z.string().min(1),
  entries: z.array(z.object({
    key: z.string().min(1),
    // value is required but can be any JSON-compatible value
    value: z.unknown().transform(v => v),
    ttl: z.number().positive().optional(),
  })),
});

// ---- MemoryService ----
export class MemoryService {
  // Layer 1: Working Memory (per-conversation, ephemeral, process-local)
  private workingMemory: Map<string, WorkingMemoryEntry[]> = new Map();

  constructor(private knowledgeService: KnowledgeService) {}

  // ===== Layer 1: Working Memory =====

  setWorkingMemory(conversationId: string, entries: Omit<WorkingMemoryEntry, 'createdAt'>[]): void {
    const now = Date.now();
    this.workingMemory.set(
      conversationId,
      entries.map((e) => ({ ...e, createdAt: now })),
    );
  }

  getWorkingMemory(conversationId: string): WorkingMemoryEntry[] {
    const entries = this.workingMemory.get(conversationId) ?? [];
    const now = Date.now();
    // Filter expired and clean up
    const valid = entries.filter((e) => !e.ttl || now - e.createdAt < e.ttl);
    this.workingMemory.set(conversationId, valid);
    return valid;
  }

  clearWorkingMemory(conversationId: string): void {
    this.workingMemory.delete(conversationId);
  }

  // ===== Layer 2: Short-term Memory =====

  async storeShortTermMemory(input: ShortTermMemoryInput): Promise<void> {
    const parsed = shortTermSchema.parse(input);
    const text = parsed.messages
      .map((m) => `[${m.timestamp}] ${m.role}: ${m.content}`)
      .join('\n');

    await this.knowledgeService.addDocument({
      text,
      metadata: {
        memoryType: 'short-term',
        conversationId: parsed.conversationId,
        messageCount: parsed.messages.length,
      },
      source: `conversation:${parsed.conversationId}`,
    });
  }

  async recallShortTermMemory(conversationId: string, limit = 10): Promise<SearchResult[]> {
    return this.knowledgeService.search({
      query: `conversation ${conversationId}`,
      topK: limit,
      threshold: 0.0,
      filters: { memoryType: 'short-term', conversationId },
    });
  }

  // ===== Layer 3: Long-term Memory =====

  async storeLongTermMemory(input: LongTermMemoryInput): Promise<{ documentIds: string[]; chunkCount: number }> {
    return this.knowledgeService.addDocument({
      text: input.content,
      metadata: {
        memoryType: 'long-term',
        conversationId: input.conversationId ?? null,
        ...input.metadata,
      },
      source: input.conversationId ? `conversation:${input.conversationId}` : 'manual',
    });
  }

  async recallLongTermMemory(query: string, topK = 10, threshold = 0.5): Promise<SearchResult[]> {
    return this.knowledgeService.search({
      query,
      topK,
      threshold,
      filters: { memoryType: 'long-term' },
    });
  }
}
