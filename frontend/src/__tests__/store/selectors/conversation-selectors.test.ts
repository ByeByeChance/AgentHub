import { describe, it, expect } from 'vitest';

// Test the conversation selector logic in isolation.
// These pure-function tests validate sorting, filtering, and pinning logic.

describe('conversation selector logic', () => {
  interface Conversation {
    id: string;
    title: string;
    agentIds: string[];
    pinnedAt: string | null;
    createdAt: string;
  }

  const makeConv = (overrides: Partial<Conversation> = {}): Conversation => ({
    id: 'c1',
    title: 'Test Conversation',
    agentIds: ['a1'],
    pinnedAt: null,
    createdAt: '2026-06-25T10:00:00.000Z',
    ...overrides,
  });

  describe('pinned vs recent split', () => {
    it('should separate pinned from unpinned conversations', () => {
      const conversations: Conversation[] = [
        makeConv({ id: 'c1', pinnedAt: '2026-06-25T12:00:00.000Z' }),
        makeConv({ id: 'c2', pinnedAt: null, createdAt: '2026-06-25T10:00:00.000Z' }),
        makeConv({ id: 'c3', pinnedAt: '2026-06-25T11:00:00.000Z' }),
        makeConv({ id: 'c4', pinnedAt: null, createdAt: '2026-06-25T11:00:00.000Z' }),
      ];

      const pinned = conversations
        .filter((c) => c.pinnedAt !== null)
        .sort((a, b) => ((b.pinnedAt ?? '') > (a.pinnedAt ?? '') ? 1 : -1));

      const recent = conversations
        .filter((c) => c.pinnedAt === null)
        .sort((a, b) => (b.createdAt > a.createdAt ? -1 : 1));

      expect(pinned).toHaveLength(2);
      expect(pinned.map((c) => c.id)).toEqual(['c1', 'c3']); // newest pin first
      expect(recent).toHaveLength(2);
      expect(recent.map((c) => c.id)).toEqual(['c2', 'c4']);
    });

    it('should return empty pinned array when nothing is pinned', () => {
      const conversations: Conversation[] = [
        makeConv({ id: 'c1' }),
        makeConv({ id: 'c2' }),
      ];
      const pinned = conversations.filter((c) => c.pinnedAt !== null);
      expect(pinned).toHaveLength(0);
    });
  });

  describe('search filtering', () => {
    function searchFilter(conversations: Conversation[], query: string): Conversation[] {
      if (!query) return conversations;
      const q = query.toLowerCase();
      return conversations.filter((c) => c.title.toLowerCase().includes(q));
    }

    it('should return all conversations when query is empty', () => {
      const conversations = [makeConv({ id: 'c1' }), makeConv({ id: 'c2' })];
      expect(searchFilter(conversations, '')).toHaveLength(2);
    });

    it('should filter by title substring (case-insensitive)', () => {
      const conversations: Conversation[] = [
        makeConv({ id: 'c1', title: 'Frontend Review' }),
        makeConv({ id: 'c2', title: 'Backend Planning' }),
        makeConv({ id: 'c3', title: 'frontend bugfix' }),
      ];
      const result = searchFilter(conversations, 'frontend');
      expect(result.map((c) => c.id)).toEqual(['c1', 'c3']);
    });

    it('should return empty when no title matches', () => {
      const conversations = [makeConv({ id: 'c1', title: 'Chat' })];
      expect(searchFilter(conversations, 'nonexistent')).toHaveLength(0);
    });
  });

  describe('lookup by id', () => {
    it('should find conversation by id', () => {
      const conversations: Conversation[] = [
        makeConv({ id: 'c1', title: 'Alpha' }),
        makeConv({ id: 'c2', title: 'Beta' }),
      ];
      const found = conversations.find((c) => c.id === 'c2');
      expect(found?.title).toBe('Beta');
    });

    it('should return undefined for unknown id', () => {
      const conversations = [makeConv({ id: 'c1' })];
      expect(conversations.find((c) => c.id === 'c99')).toBeUndefined();
    });
  });
});
