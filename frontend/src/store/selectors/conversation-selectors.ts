import { useStore } from '../index';

export function usePinnedConversations() {
  return useStore((s) =>
    Object.values(s.conversations)
      .filter((c) => c.pinnedAt !== null)
      .sort((a, b) =>
        (b.pinnedAt ?? '') > (a.pinnedAt ?? '') ? 1 : -1,
      ),
  );
}

export function useRecentConversations() {
  return useStore((s) =>
    Object.values(s.conversations)
      .filter((c) => c.pinnedAt === null)
      .sort((a, b) => (b.createdAt > a.createdAt ? -1 : 1)),
  );
}

export function useFilteredConversations() {
  return useStore((s) => {
    const query = s.ui.conversationSearchQuery.toLowerCase();
    const all = Object.values(s.conversations);
    if (!query) return all;
    return all.filter((c) => c.title.toLowerCase().includes(query));
  });
}

export function useConversation(id: string | null) {
  return useStore((s) => (id ? s.conversations[id] : null));
}
