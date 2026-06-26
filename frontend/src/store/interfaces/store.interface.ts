import type { EventEnvelope } from '@/lib/constants';
import type { Conversation } from './conversation.interface.js';
import type { Message, MessagePart } from './message.interface.js';
import type { AgentMetadata, AgentFull } from './agent.interface.js';
import type { Artifact } from './artifact.interface.js';
import type { ApiKeyEntry } from './api-key.interface.js';
import type { UIState } from './ui-state.interface.js';

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
    agentId?: string,
  ) => Promise<void>;
  addOptimisticMessage: (message: Message) => void;
  appendMessagePart: (messageId: string, part: MessagePart) => void;
  updateMessageStatus: (
    messageId: string,
    status: Message['status'],
  ) => void;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  resendMessage: (conversationId: string, content: string) => Promise<void>;
  stopStreaming: () => void;

  // Agents
  fetchAgents: (category?: string, search?: string, locale?: string) => Promise<void>;
  fetchAgentDetail: (agentId: string, locale?: string) => Promise<void>;
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

  // Settings
  addApiKey: (entry: ApiKeyEntry) => void;
  removeApiKey: (provider: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export type AgentHubStore = AgentHubState & AgentHubActions;
