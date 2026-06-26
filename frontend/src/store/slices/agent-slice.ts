import type { StateCreator } from 'zustand';
import type { AgentMetadata, AgentFull, AgentHubStore } from '@/store/interfaces/index.js';
import { apiClient } from '@/lib/api-client';
import { logger } from '@/lib/logger';

export interface AgentSlice {
  agents: Record<string, AgentMetadata>;
  agentDetails: Record<string, AgentFull>;
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
}

export const createAgentSlice: StateCreator<
  AgentHubStore,
  [['zustand/immer', never]],
  [],
  AgentSlice
> = (set) => ({
  agents: {},
  agentDetails: {},

  fetchAgents: async (category?: string, search?: string, locale?: string) => {
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      if (locale) params.set('locale', locale);
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

  fetchAgentDetail: async (agentId: string, locale?: string) => {
    try {
      const params = locale ? `?locale=${locale}` : '';
      const data = await apiClient.get<AgentFull>(
        `/api/agents/${agentId}${params}`,
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
});
