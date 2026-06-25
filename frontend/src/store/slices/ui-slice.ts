import type { StateCreator } from 'zustand';
import type { UIState, AgentHubStore } from '@/store/interfaces/index.js';
import { initialUI } from '@/store/initial-state';

export interface UISlice {
  ui: UIState;
  setActiveConversation: (id: string | null) => void;
  setActiveAgent: (id: string | null) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelTab: (tab: 'agent' | 'artifacts') => void;
  setSelectedArtifact: (id: string | null) => void;
  setSidebarTab: (tab: 'chat' | 'agents' | 'settings') => void;
  setSSEStatus: (status: 'connecting' | 'connected' | 'disconnected') => void;
  setConversationSearchQuery: (query: string) => void;
  setMessageSearchQuery: (query: string) => void;
  toggleMessageSearch: () => void;
  setAgentSearchQuery: (query: string) => void;
  setAgentCategoryFilter: (category: string | null) => void;
}

export const createUISlice: StateCreator<
  AgentHubStore,
  [['zustand/immer', never]],
  [],
  UISlice
> = (set) => ({
  ui: { ...initialUI },

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
});
