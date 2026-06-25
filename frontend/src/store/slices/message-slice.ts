import type { StateCreator } from 'zustand';
import type {
  Message,
  MessagePart,
  AgentHubStore,
  Artifact,
} from '@/store/interfaces/index.js';
import type { EventEnvelope } from '@/lib/constants';
import { applyStreamEvent } from '@/store/reducers/stream-reducer';
import { parseSSEStream } from '@/lib/stream-parser';
import { apiClient } from '@/lib/api-client';
import { logger } from '@/lib/logger';

// AbortController ref for stopping active streams (not serializable, kept outside store)
let activeStreamController: AbortController | null = null;

export interface MessageSlice {
  messages: Record<string, Message>;
  artifacts: Record<string, Artifact>;
  dispatchStreamEvent: (event: EventEnvelope) => void;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    agentId?: string,
  ) => Promise<void>;
  stopStreaming: () => void;
  addOptimisticMessage: (message: Message) => void;
  appendMessagePart: (messageId: string, part: MessagePart) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  resendMessage: (conversationId: string, content: string) => Promise<void>;
}

export const createMessageSlice: StateCreator<
  AgentHubStore,
  [['zustand/immer', never]],
  [],
  MessageSlice
> = (set, get) => ({
  messages: {},
  artifacts: {},

  // Stream event dispatcher — delegates to the pure reducer
  dispatchStreamEvent: (event: EventEnvelope) => {
    set((draft) => {
      applyStreamEvent(draft, event);
    });
  },

  fetchMessages: async (conversationId: string) => {
    try {
      const data = await apiClient.get<Message[]>(
        `/api/conversations/${conversationId}/messages`,
      );
      set((draft) => {
        for (const m of data) {
          draft.messages[m.id] = m;
        }
      });
    } catch (err) {
      logger.error('Failed to fetch messages', { error: String(err) });
    }
  },

  sendMessage: async (conversationId: string, content: string, agentId?: string) => {
    const state = get();
    const conv = state.conversations[conversationId];
    if (!conv) return;

    // Use the specified agent, or the active agent, or the first assigned agent
    const resolvedAgentId = agentId ?? state.ui.activeAgentId ?? conv.agentIds[0];
    if (!resolvedAgentId) return;

    // Optimistic user message
    const now = Date.now();
    const userMsgId = crypto.randomUUID();
    const userMsg: Message = {
      id: userMsgId,
      conversationId,
      role: 'user',
      parts: [{ type: 'text', content }],
      status: 'complete',
      createdAt: new Date(now).toISOString(),
    };

    // Optimistic assistant message (will be filled by stream)
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      parts: [],
      status: 'streaming',
      createdAt: new Date(now + 1).toISOString(),
    };

    set((draft) => {
      draft.messages[userMsgId] = userMsg;
      draft.messages[assistantMsgId] = assistantMsg;
      draft.ui.isStreaming = true;
      draft.ui.streamingMessageId = assistantMsgId;
    });

    // Create an AbortController so the stop button can cancel this stream
    if (activeStreamController) activeStreamController.abort();
    const controller = new AbortController();
    activeStreamController = controller;

    try {
      const stream = await apiClient.streamPost(
        `/api/conversations/${conversationId}/messages`,
        { content, userMessageId: userMsgId, assistantMessageId: assistantMsgId, agentId: resolvedAgentId },
        controller.signal,
      );

      await parseSSEStream(stream, (event) => {
        set((draft) => {
          applyStreamEvent(draft, event);
        });
      });
    } catch (err) {
      const isAborted = err instanceof DOMException && err.name === 'AbortError';
      logger.error(isAborted ? 'Stream aborted by user' : 'Stream error', { error: String(err) });
      set((draft) => {
        const msg = draft.messages[assistantMsgId];
        if (msg) msg.status = isAborted ? 'aborted' : 'failed';
        draft.ui.isStreaming = false;
        draft.ui.streamingMessageId = null;
      });
    } finally {
      if (activeStreamController === controller) {
        activeStreamController = null;
      }
    }
  },

  stopStreaming: () => {
    if (activeStreamController) {
      activeStreamController.abort();
    }
    set((draft) => {
      draft.ui.isStreaming = false;
      draft.ui.streamingMessageId = null;
    });
  },

  addOptimisticMessage: (message: Message) => {
    set((draft) => {
      draft.messages[message.id] = message;
    });
  },

  appendMessagePart: (messageId: string, part: MessagePart) => {
    set((draft) => {
      const msg = draft.messages[messageId];
      if (msg) {
        msg.parts.push(part);
      }
    });
  },

  updateMessageStatus: (messageId: string, status: Message['status']) => {
    set((draft) => {
      const msg = draft.messages[messageId];
      if (msg) {
        msg.status = status;
      }
    });
  },

  deleteMessage: async (conversationId: string, messageId: string) => {
    set((draft) => {
      delete draft.messages[messageId];
    });
    try {
      await apiClient.delete(`/api/conversations/${conversationId}/messages/${messageId}`);
    } catch (err) {
      logger.error('Failed to delete message', { error: String(err), messageId });
      // Re-fetch messages to restore state on failure
      try { await get().fetchMessages(conversationId); } catch { /* best-effort */ }
    }
  },

  resendMessage: async (conversationId: string, content: string) => {
    await get().sendMessage(conversationId, content);
  },
});
