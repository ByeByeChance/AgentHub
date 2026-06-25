import type { UIState } from './interfaces/ui-state.interface.js';

export const initialUI: UIState = {
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
