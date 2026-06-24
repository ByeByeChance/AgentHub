'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/index';
import { useFilteredAgents } from '@/store/selectors/agent-selectors';
import { AgentCard } from '@/components/agent/agent-card';
import { AgentCategoryFilter } from '@/components/agent/agent-category-filter';
import { AgentSearchInput } from '@/components/agent/agent-search-input';
import { AgentCreateDialog } from '@/components/agent/agent-create-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';

export default function AgentsPage() {
  const fetchAgents = useStore((s) => s.fetchAgents);
  const setSidebarTab = useStore((s) => s.setSidebarTab);
  const agents = useFilteredAgents();
  const isLoading = agents.length === 0;

  useEffect(() => {
    setSidebarTab('agents');
    void fetchAgents();
  }, [fetchAgents, setSidebarTab]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Browse, search, and create AI agents
            </p>
          </div>
          <AgentCreateDialog>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Agent
            </Button>
          </AgentCreateDialog>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <AgentSearchInput />
          <AgentCategoryFilter />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No agents found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
