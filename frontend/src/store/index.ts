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
  isDetailPanelOpen: false,
  detailPanelTab: 'agent',
  selectedArtifactId: null,
  sidebarTab: 'chat',
  isCreatingConversation: false,
  isStreaming: false,
  streamingMessageId: null,
  globalSSEStatus: 'disconnected',
  conversationSearchQuery: '',
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

  sendMessage: async (conversationId: string, content: string) => {
    const state = get();
    const conv = state.conversations[conversationId];
    if (!conv) return;

    // Optimistic user message
    const userMsgId = crypto.randomUUID();
    const userMsg: Message = {
      id: userMsgId,
      conversationId,
      role: 'user',
      parts: [{ type: 'text', content }],
      status: 'complete',
      createdAt: new Date().toISOString(),
    };

    // Optimistic assistant message (will be filled by stream)
    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      conversationId,
      role: 'assistant',
      parts: [],
      status: 'streaming',
      createdAt: new Date().toISOString(),
    };

    set((draft) => {
      draft.messages[userMsgId] = userMsg;
      draft.messages[assistantMsgId] = assistantMsg;
      draft.ui.isStreaming = true;
      draft.ui.streamingMessageId = assistantMsgId;
    });

    try {
      const stream = await apiClient.streamPost(
        `/api/conversations/${conversationId}/messages`,
        { content, userMessageId: userMsgId, assistantMessageId: assistantMsgId },
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
      logger.error('Stream error', { error: String(err) });
      set((draft) => {
        const msg = draft.messages[assistantMsgId];
        if (msg) msg.status = 'failed';
        draft.ui.isStreaming = false;
        draft.ui.streamingMessageId = null;
      });
    }
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

export const useStore = create<AgentHubStore>()(immer(storeCreator));
