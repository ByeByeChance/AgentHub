import { create, type StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { EventEnvelope } from '@/lib/constants';
import { applyStreamEvent } from './reducers/stream-reducer';
import { apiClient } from '@/lib/api-client';
import { logger } from '@/lib/logger';

// ---- Types (mirror backend) ----

export interface Conversation {
  id: string;
  title: string;
  mode: 'single' | 'group';
  agentIds: string[];
  pinnedAt: string | null;
  createdAt: string;
}

export interface MessagePart {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'artifact_ref';
  content?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  artifactId?: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  status: 'streaming' | 'complete' | 'aborted' | 'failed';
  createdAt: string;
}

export interface AgentMetadata {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  isBuiltin: boolean;
  isOrchestrator: boolean;
  createdAt: string;
}

export interface AgentFull extends AgentMetadata {
  systemPrompt: string;
  adapterName: string;
  modelId: string;
  toolNames: string[];
}

export interface Artifact {
  id: string;
  conversationId: string;
  type: 'web_app' | 'document' | 'code' | 'image';
  title: string;
  content: unknown;
  version: number;
  parentArtifactId: string | null;
  createdAt: string;
}

export interface ApiKeyEntry {
  provider: string;
  keyPrefix: string;
  createdAt: string;
}

export interface UIState {
  activeConversationId: string | null;
  isDetailPanelOpen: boolean;
  detailPanelTab: 'agent' | 'artifacts';
  selectedArtifactId: string | null;
  sidebarTab: 'chat' | 'agents' | 'settings';
  isCreatingConversation: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  globalSSEStatus: 'connecting' | 'connected' | 'disconnected';
  conversationSearchQuery: string;
  agentSearchQuery: string;
  agentCategoryFilter: string | null;
}

// ---- Complete State Shape ----

export interface AgentHubState {
  conversations: Record<string, Conversation>;
  messages: Record<string, Message>;
  agents: Record<string, AgentMetadata>;
  agentDetails: Record<string, AgentFull>;
  artifacts: Record<string, Artifact>;
  ui: UIState;
  settings: {
    apiKeys: ApiKeyEntry[];
    theme: 'light' | 'dark' | 'system';
  };
}

export interface AgentHubActions {
  // Stream event dispatcher
  dispatchStreamEvent: (event: EventEnvelope) => void;

  // Conversations
  fetchConversations: () => Promise<void>;
  createConversation: (input: {
    title?: string;
    mode?: 'single' | 'group';
    agentIds: string[];
  }) => Promise<Conversation>;
  pinConversation: (id: string) => void;
  archiveConversation: (id: string) => void;

  // Messages
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
  ) => Promise<void>;
  addOptimisticMessage: (message: Message) => void;
  appendMessagePart: (messageId: string, part: MessagePart) => void;
  updateMessageStatus: (
    messageId: string,
    status: Message['status'],
  ) => void;

  // Agents
  fetchAgents: (category?: string, search?: string) => Promise<void>;
  fetchAgentDetail: (agentId: string) => Promise<void>;
  createAgent: (input: {
    name: string;
    emoji: string;
    description: string;
    category: string;
    systemPrompt: string;
    toolNames?: string[];
  }) => Promise<AgentFull>;

  // UI actions
  setActiveConversation: (id: string | null) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelTab: (tab: 'agent' | 'artifacts') => void;
  setSelectedArtifact: (id: string | null) => void;
  setSidebarTab: (tab: 'chat' | 'agents' | 'settings') => void;
  setSSEStatus: (status: 'connecting' | 'connected' | 'disconnected') => void;
  setConversationSearchQuery: (query: string) => void;
  setAgentSearchQuery: (query: string) => void;
  setAgentCategoryFilter: (category: string | null) => void;

  // Settings
  addApiKey: (entry: ApiKeyEntry) => void;
  removeApiKey: (provider: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export type AgentHubStore = AgentHubState & AgentHubActions;

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
    const data = await apiClient.post<Conversation>(
      '/api/conversations',
      input,
    );
    set((draft) => {
      draft.conversations[data.id] = data;
      draft.ui.activeConversationId = data.id;
    });
    return data;
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
        { content },
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
