export interface Conversation {
  id: string;
  title: string;
  mode: 'single' | 'group';
  agentIds: string[];
  pinnedAt: string | null;
  createdAt: string;
}
