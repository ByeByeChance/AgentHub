import { create, type StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { EventEnvelope } from '@/lib/constants';
import { applyStreamEvent } from './reducers/stream-reducer';
import { apiClient } from '@/lib/api-client';
import { logger } from '@/lib/logger';
import type {
  Conversation,
  Message,
  MessagePart,
  AgentMetadata,
  AgentFull,
  UIState,
  AgentHubState,
  AgentHubStore,
} from './interfaces/index.js';

// Re-export types for backward compatibility
export type {
  Conversation,
  Message,
  MessagePart,
  AgentMetadata,
  AgentFull,
  Artifact,
  ApiKeyEntry,
  UIState,
  AgentHubState,
  AgentHubActions,
  AgentHubStore,
} from './interfaces/index.js';

// ---- Initial State ----

const initialUI: UIState = {
  activeConversationId: null,
  activeAgentId: null,
  isDetailPanelOpen: false,
  detailPanelTab: 'agent',
  selectedArtifactId: null,
  sidebarTab: 'chat',
  isCreatingConversation: false,
  isStreaming: false,
  streamingMessageId: null,
  globalSSEStatus: 'disconnected',
  conversationSearchQuery: '',
  messageSearchQuery: '',
  isMessageSearchOpen: false,
  agentSearchQuery: '',
  agentCategoryFilter: null,
};

const initialState: AgentHubState = {
  conversations: {},
  messages: {},
  agents: {},
  agentDetails: {},
  artifacts: {},
  ui: { ...initialUI },
  settings: {
    apiKeys: [],
    theme: 'system',
  },
};

// ---- Store Creator ----

const storeCreator: StateCreator<AgentHubStore, [['zustand/immer', never]]> = (
  set,
  get,
) => ({
  ...initialState,

  // Stream event dispatcher
  dispatchStreamEvent: (event: EventEnvelope) => {
    set((draft) => {
      applyStreamEvent(draft, event);
    });
  },

  // ---- Conversations ----
  fetchConversations: async () => {
    try {
      const data = await apiClient.get<Conversation[]>('/api/conversations');
      set((draft) => {
        for (const c of data) {
          draft.conversations[c.id] = c;
        }
      });
    } catch (err) {
      logger.error('Failed to fetch conversations', {
        error: String(err),
      });
    }
  },

  createConversation: async (input) => {
    try {
      const data = await apiClient.post<Conversation>(
        '/api/conversations',
        input,
      );
      set((draft) => {
        draft.conversations[data.id] = data;
        draft.ui.activeConversationId = data.id;
      });
      return data;
    } catch (err) {
      logger.error('Failed to create conversation', { error: String(err), input });
      throw err;
    }
  },

  pinConversation: (id: string) => {
    set((draft) => {
      const conv = draft.conversations[id];
      if (conv) {
        conv.pinnedAt = conv.pinnedAt ? null : new Date().toISOString();
      }
    });
  },

  archiveConversation: (id: string) => {
    set((draft) => {
      delete draft.conversations[id];
      if (draft.ui.activeConversationId === id) {
        draft.ui.activeConversationId = null;
      }
    });
  },

  // ---- Messages ----
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
    // Offset by 1ms so the user message always sorts first when timestamps are compared
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

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const event = JSON.parse(jsonStr) as EventEnvelope;
              set((draft) => {
                applyStreamEvent(draft, event);
              });
            } catch {
              logger.warn('Failed to parse SSE line', { line: trimmed });
            }
          }
        }
      }
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

  updateMessageStatus: (
    messageId: string,
    status: Message['status'],
  ) => {
    set((draft) => {
      const msg = draft.messages[messageId];
      if (msg) {
        msg.status = status;
      }
    });
  },

  deleteMessage: async (conversationId: string, messageId: string) => {
    // Optimistic removal
    set((draft) => {
      delete draft.messages[messageId];
    });
    try {
      await apiClient.delete(`/api/conversations/${conversationId}/messages/${messageId}`);
    } catch (err) {
      logger.error('Failed to delete message', { error: String(err), messageId });
      // Re-fetch messages to restore state on failure
      const state = get();
      try { await state.fetchMessages(conversationId); } catch { /* best-effort */ }
    }
  },

  resendMessage: async (conversationId: string, content: string) => {
    const state = get();
    await state.sendMessage(conversationId, content);
  },

  // ---- Agents ----
  fetchAgents: async (category?: string, search?: string) => {
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      const queryStr = params.toString();
      const path = queryStr ? `/api/agents?${queryStr}` : '/api/agents';
      const data = await apiClient.get<AgentMetadata[]>(path);
      set((draft) => {
        for (const a of data) {
          draft.agents[a.id] = a;
        }
      });
    } catch (err) {
      logger.error('Failed to fetch agents', { error: String(err) });
    }
  },

  fetchAgentDetail: async (agentId: string) => {
    try {
      const data = await apiClient.get<AgentFull>(
        `/api/agents/${agentId}`,
      );
      set((draft) => {
        draft.agentDetails[agentId] = data;
      });
    } catch (err) {
      logger.error('Failed to fetch agent detail', {
        error: String(err),
      });
    }
  },

  createAgent: async (input) => {
    try {
      const data = await apiClient.post<AgentFull>('/api/agents', input);
      set((draft) => {
        draft.agents[data.id] = {
          id: data.id,
          name: data.name,
          emoji: data.emoji,
          description: data.description,
          category: data.category,
          isBuiltin: data.isBuiltin,
          isOrchestrator: data.isOrchestrator,
          createdAt: data.createdAt,
        };
        draft.agentDetails[data.id] = data;
      });
      return data;
    } catch (err) {
      logger.error('Failed to create agent', { error: String(err), input });
      throw err;
    }
  },

  // ---- UI Actions ----
  setActiveConversation: (id) => {
    set((draft) => {
      draft.ui.activeConversationId = id;
    });
  },

  setActiveAgent: (id) => {
    set((draft) => {
      draft.ui.activeAgentId = id;
    });
  },

  setDetailPanelOpen: (open) => {
    set((draft) => {
      draft.ui.isDetailPanelOpen = open;
    });
  },

  setDetailPanelTab: (tab) => {
    set((draft) => {
      draft.ui.detailPanelTab = tab;
    });
  },

  setSelectedArtifact: (id) => {
    set((draft) => {
      draft.ui.selectedArtifactId = id;
    });
  },

  setSidebarTab: (tab) => {
    set((draft) => {
      draft.ui.sidebarTab = tab;
    });
  },

  setSSEStatus: (status) => {
    set((draft) => {
      draft.ui.globalSSEStatus = status;
    });
  },

  setConversationSearchQuery: (query) => {
    set((draft) => {
      draft.ui.conversationSearchQuery = query;
    });
  },

  setAgentSearchQuery: (query) => {
    set((draft) => {
      draft.ui.agentSearchQuery = query;
    });
  },

  setMessageSearchQuery: (query) => {
    set((draft) => {
      draft.ui.messageSearchQuery = query;
    });
  },

  toggleMessageSearch: () => {
    set((draft) => {
      draft.ui.isMessageSearchOpen = !draft.ui.isMessageSearchOpen;
      if (!draft.ui.isMessageSearchOpen) {
        draft.ui.messageSearchQuery = '';
      }
    });
  },

  setAgentCategoryFilter: (category) => {
    set((draft) => {
      draft.ui.agentCategoryFilter = category;
    });
  },

  // ---- Settings ----
  addApiKey: (entry) => {
    set((draft) => {
      const existing = draft.settings.apiKeys.findIndex(
        (k) => k.provider === entry.provider,
      );
      if (existing >= 0) {
        draft.settings.apiKeys[existing] = entry;
      } else {
        draft.settings.apiKeys.push(entry);
      }
    });
  },

  removeApiKey: (provider) => {
    set((draft) => {
      draft.settings.apiKeys = draft.settings.apiKeys.filter(
        (k) => k.provider !== provider,
      );
    });
  },

  setTheme: (theme) => {
    set((draft) => {
      draft.settings.theme = theme;
    });
  },
});

// AbortController ref for stopping active streams (not serializable, kept outside store)
let activeStreamController: AbortController | null = null;

export const useStore = create<AgentHubStore>()(immer(storeCreator));
