import type { StateCreator } from 'zustand';
import type { Conversation, AgentHubStore } from '@/store/interfaces/index.js';
import { apiClient } from '@/lib/api-client';
import { logger } from '@/lib/logger';

export interface ConversationSlice {
  conversations: Record<string, Conversation>;
  fetchConversations: () => Promise<void>;
  createConversation: (input: {
    title?: string;
    mode?: 'single' | 'group';
    agentIds: string[];
  }) => Promise<Conversation>;
  pinConversation: (id: string) => void;
  archiveConversation: (id: string) => void;
}

export const createConversationSlice: StateCreator<
  AgentHubStore,
  [['zustand/immer', never]],
  [],
  ConversationSlice
> = (set) => ({
  conversations: {},

  fetchConversations: async () => {
    try {
      const data = await apiClient.get<Conversation[]>('/conversations');
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
        '/conversations',
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
});
