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
