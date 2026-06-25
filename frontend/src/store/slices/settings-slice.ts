import type { StateCreator } from 'zustand';
import type { ApiKeyEntry, AgentHubStore } from '@/store/interfaces/index.js';

export interface SettingsSlice {
  settings: {
    apiKeys: ApiKeyEntry[];
    theme: 'light' | 'dark' | 'system';
  };
  addApiKey: (entry: ApiKeyEntry) => void;
  removeApiKey: (provider: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const createSettingsSlice: StateCreator<
  AgentHubStore,
  [['zustand/immer', never]],
  [],
  SettingsSlice
> = (set) => ({
  settings: {
    apiKeys: [],
    theme: 'system' as const,
  },

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
