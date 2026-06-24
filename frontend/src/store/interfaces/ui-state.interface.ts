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
