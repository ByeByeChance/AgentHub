import { useMemo } from 'react';
import { useStore } from '../index';

export function useFilteredAgents() {
  const agents = useStore((s) => s.agents);
  const searchQuery = useStore((s) => s.ui.agentSearchQuery);
  const categoryFilter = useStore((s) => s.ui.agentCategoryFilter);
  return useMemo(() => {
    let result = Object.values(agents);

    if (categoryFilter) {
      result = result.filter((a) => a.category === categoryFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q),
      );
    }

    return result;
  }, [agents, searchQuery, categoryFilter]);
}

export function useAgentDetail(agentId: string | null) {
  const agentDetails = useStore((s) => s.agentDetails);
  return useMemo(() => {
    if (!agentId) return null;
    return agentDetails[agentId] ?? null;
  }, [agentDetails, agentId]);
}

export function useAgentCategories(): string[] {
  const agents = useStore((s) => s.agents);
  return useMemo(() => {
    const categories = new Set<string>();
    for (const a of Object.values(agents)) {
      categories.add(a.category);
    }
    return Array.from(categories).sort();
  }, [agents]);
}

export function useAgent(agentId: string | null) {
  const agents = useStore((s) => s.agents);
  const agentDetails = useStore((s) => s.agentDetails);
  return useMemo(() => {
    if (!agentId) return null;
    // AgentFull extends AgentMetadata — prefer the detail (more fields) if available
    return agentDetails[agentId] ?? agents[agentId] ?? null;
  }, [agents, agentDetails, agentId]);
}
