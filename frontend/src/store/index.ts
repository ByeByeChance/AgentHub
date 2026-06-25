import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AgentHubStore } from './interfaces/index.js';
import { createConversationSlice } from './slices/conversation-slice';
import { createMessageSlice } from './slices/message-slice';
import { createAgentSlice } from './slices/agent-slice';
import { createUISlice } from './slices/ui-slice';
import { createSettingsSlice } from './slices/settings-slice';

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

export const useStore = create<AgentHubStore>()(
  immer((...args) => ({
    ...createConversationSlice(...args),
    ...createMessageSlice(...args),
    ...createAgentSlice(...args),
    ...createUISlice(...args),
    ...createSettingsSlice(...args),
  })),
);
