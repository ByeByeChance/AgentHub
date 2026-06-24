import { useStore } from '../index';

export function useConversationMessages(conversationId: string | null) {
  return useStore((s) => {
    if (!conversationId) return [];
    return Object.values(s.messages)
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  });
}

export function useLastMessagePreview(conversationId: string): string {
  return useStore((s) => {
    const msgs = Object.values(s.messages)
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    const last = msgs[0];
    if (!last) return 'No messages yet';
    const textPart = last.parts.find((p) => p.type === 'text');
    if (textPart?.content) {
      const preview = textPart.content.slice(0, 60);
      return preview.length < textPart.content.length
        ? `${preview}...`
        : preview;
    }
    if (last.parts.some((p) => p.type === 'tool_use'))
      return 'Tool invocation...';
    if (last.parts.some((p) => p.type === 'thinking'))
      return 'Thinking...';
    return 'Message';
  });
}

export function useIsStreaming() {
  return useStore((s) => s.ui.isStreaming);
}

export function useStreamingMessageId() {
  return useStore((s) => s.ui.streamingMessageId);
}
