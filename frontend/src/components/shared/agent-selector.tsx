'use client';

import type { AgentMetadata } from '@/store/interfaces';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

interface AgentSelectorProps {
  /** Full list of agents to display */
  agents: AgentMetadata[];
  /** Currently selected agent IDs */
  selectedIds: string[];
  /** Called when an agent is toggled (parent controls single/multiple logic) */
  onToggle: (agentId: string) => void;
  /** Optional search query to filter agents (client-side) */
  searchQuery?: string;
  /** Max height for the scroll area (default: 'h-56') */
  maxHeight?: string;
  /** Whether to show the category badge for each agent */
  showCategory?: boolean;
}

/**
 * Reusable agent selector used in dialogs.
 *
 * Renders a scrollable list of agents with checkbox-like selection,
 * plus selected-agent badges above the list.
 *
 * Used by:
 * - ConversationCreateDialog (single / group mode)
 * - OrchestratorDialog (multiple mode)
 */
export function AgentSelector({
  agents,
  selectedIds,
  onToggle,
  searchQuery,
  maxHeight = 'h-56',
  showCategory = true,
}: AgentSelectorProps) {
  const filtered = searchQuery
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : agents;

  const selectedAgents = agents.filter((a) => selectedIds.includes(a.id));

  return (
    <>
      {/* Selected agent badges */}
      {selectedAgents.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedAgents.map((a) => (
            <Badge
              key={a.id}
              variant="secondary"
              className="gap-1.5 cursor-pointer interactive pl-2 pr-1.5 py-1 rounded-lg"
              onClick={() => onToggle(a.id)}
            >
              {a.emoji} {a.name}
              <X className="w-3 h-3 ml-0.5" />
            </Badge>
          ))}
        </div>
      )}

      {/* Agent list */}
      <ScrollArea className={`${maxHeight} rounded-xl border border-border/40`}>
        <div className="p-3 space-y-0.5">
          {filtered.map((agent) => {
            const isSelected = selectedIds.includes(agent.id);
            return (
              <div
                key={agent.id}
                onClick={() => onToggle(agent.id)}
                className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer interactive ${
                  isSelected
                    ? 'bg-secondary text-secondary-foreground ring-1 ring-border/50'
                    : 'hover:bg-muted/70'
                }`}
              >
                {/* Emoji */}
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base flex-shrink-0">
                  {agent.emoji}
                </div>
                {/* Info — truncate long descriptions */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {agent.description}
                  </p>
                </div>
                {/* Category */}
                {showCategory && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0"
                  >
                    {agent.category}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}
