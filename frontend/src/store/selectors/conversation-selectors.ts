import { useMemo } from 'react';
import { useStore } from '../index';

export function usePinnedConversations() {
  const conversations = useStore((s) => s.conversations);
  return useMemo(
    () =>
      Object.values(conversations)
        .filter((c) => c.pinnedAt !== null)
        .sort((a, b) =>
          (b.pinnedAt ?? '') > (a.pinnedAt ?? '') ? 1 : -1,
        ),
    [conversations],
  );
}

export function useRecentConversations() {
  const conversations = useStore((s) => s.conversations);
  return useMemo(
    () =>
      Object.values(conversations)
        .filter((c) => c.pinnedAt === null)
        .sort((a, b) => (b.createdAt > a.createdAt ? -1 : 1)),
    [conversations],
  );
}

export function useFilteredConversations() {
  const conversations = useStore((s) => s.conversations);
  const query = useStore((s) => s.ui.conversationSearchQuery);
  return useMemo(() => {
    const lowerQuery = query.toLowerCase();
    const all = Object.values(conversations);
    if (!lowerQuery) return all;
    return all.filter((c) => c.title.toLowerCase().includes(lowerQuery));
  }, [conversations, query]);
}

export function useConversation(id: string | null) {
  return useStore((s) => (id ? s.conversations[id] : null));
}
