import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '../index';

export function useConversationMessages(conversationId: string | null) {
  const messages = useStore((s) => s.messages);
  return useMemo(() => {
    if (!conversationId) return [];
    return Object.values(messages)
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => {
        // Primary sort by createdAt (ascending — oldest first)
        if (a.createdAt < b.createdAt) return -1;
        if (a.createdAt > b.createdAt) return 1;
        // Fallback for equal timestamps: user before assistant before system
        const roleOrder: Record<string, number> = { user: 0, assistant: 1, system: 2 };
        const roleDiff = (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
        if (roleDiff !== 0) return roleDiff;
        // Final fallback: sort by ID for deterministic ordering
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      });
  }, [messages, conversationId]);
}

export function useLastMessagePreview(conversationId: string): string {
  const t = useTranslations('message');
  const messages = useStore((s) => s.messages);
  return useMemo(() => {
    const msgs = Object.values(messages)
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => {
        // Primary sort by createdAt (descending — newest first)
        if (b.createdAt < a.createdAt) return -1;
        if (b.createdAt > a.createdAt) return 1;
        // Fallback: assistant after user (assistant is the "response")
        const roleOrder: Record<string, number> = { assistant: 0, user: 1, system: 2 };
        return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
      });
    const last = msgs[0];
    if (!last) return t('noMessages');
    const textPart = last.parts.find((p) => p.type === 'text');
    if (textPart?.content) {
      const preview = textPart.content.slice(0, 60);
      return preview.length < textPart.content.length
        ? `${preview}...`
        : preview;
    }
    if (last.parts.some((p) => p.type === 'tool_use'))
      return t('toolInvocation');
    if (last.parts.some((p) => p.type === 'thinking'))
      return t('thinking');
    return t('message');
  }, [messages, conversationId, t]);
}

export function useIsStreaming() {
  return useStore((s) => s.ui.isStreaming);
}

export function useStreamingMessageId() {
  return useStore((s) => s.ui.streamingMessageId);
}

export function useMessageSearchQuery() {
  return useStore((s) => s.ui.messageSearchQuery);
}

export function useIsMessageSearchOpen() {
  return useStore((s) => s.ui.isMessageSearchOpen);
}

/** Returns the set of message IDs that match the current search query. */
export function useMessageSearchMatchIds(): Set<string> | null {
  const messages = useStore((s) => s.messages);
  const query = useStore((s) => s.ui.messageSearchQuery);
  return useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return null;
    const matches = new Set<string>();
    for (const msg of Object.values(messages)) {
      for (const part of msg.parts) {
        if (part.type === 'text' && part.content?.toLowerCase().includes(trimmed)) {
          matches.add(msg.id);
          break;
        }
        if (part.type === 'tool_use' && part.toolName?.toLowerCase().includes(trimmed)) {
          matches.add(msg.id);
          break;
        }
      }
    }
    return matches;
  }, [messages, query]);
}
