import { useStore } from '../index';

export function useFilteredAgents() {
  return useStore((s) => {
    const { agentSearchQuery, agentCategoryFilter } = s.ui;
    let agents = Object.values(s.agents);

    if (agentCategoryFilter) {
      agents = agents.filter((a) => a.category === agentCategoryFilter);
    }

    if (agentSearchQuery) {
      const q = agentSearchQuery.toLowerCase();
      agents = agents.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q),
      );
    }

    return agents;
  });
}

export function useAgentDetail(agentId: string | null) {
  return useStore((s) => {
    if (!agentId) return null;
    return s.agentDetails[agentId] ?? null;
  });
}

export function useAgentCategories(): string[] {
  return useStore((s) => {
    const categories = new Set<string>();
    for (const a of Object.values(s.agents)) {
      categories.add(a.category);
    }
    return Array.from(categories).sort();
  });
}

export function useAgent(agentId: string | null) {
  return useStore((s) => {
    if (!agentId) return null;
    return s.agents[agentId] ?? null;
  });
}
