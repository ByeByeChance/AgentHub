'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { AgentMetadata } from '@/store/interfaces';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from '@/components/ui/command';
import { X, Check } from 'lucide-react';

interface AgentSelectorProps {
  /** Full list of agents to display */
  agents: AgentMetadata[];
  /** Currently selected agent IDs */
  selectedIds: string[];
  /** Called when an agent is toggled (parent controls single/multiple logic) */
  onToggle: (agentId: string) => void;
  /** Optional external search query — when provided, disables cmdk internal filtering */
  searchQuery?: string;
  /** Max height for the list (default: 'h-56') */
  maxHeight?: string;
  /** Whether to show the category badge for each agent */
  showCategory?: boolean;
}

/**
 * Reusable agent selector using cmdk Command for keyboard-first search.
 *
 * Renders an embedded search input plus a scrollable, filterable list of agents,
 * with selected-agent badges above the list.
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
  maxHeight = 'max-h-[300px]',
  showCategory = true,
}: AgentSelectorProps) {
  const t = useTranslations('agent');
  const [internalSearch, setInternalSearch] = useState('');

  // When an external searchQuery is provided, filter manually.
  // Otherwise, cmdk's internal filtering (via keywords) handles it.
  const filtered = useMemo(() => {
    if (!searchQuery) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [agents, searchQuery]);

  const selectedAgents = useMemo(
    () => agents.filter((a) => selectedIds.includes(a.id)),
    [agents, selectedIds],
  );

  const displayedAgents = searchQuery ? filtered : agents;

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

      {/* Command-based search + list */}
      <Command
        shouldFilter={!searchQuery}
        className="rounded-xl border border-border/40"
      >
        <CommandInput
          placeholder={t('searchAgents')}
          value={searchQuery ?? internalSearch}
          onValueChange={setInternalSearch}
          autoFocus
        />
        <CommandList className={maxHeight}>
          <CommandEmpty>{t('noAgentsMatch')}</CommandEmpty>
          {displayedAgents.map((agent) => {
            const isSelected = selectedIds.includes(agent.id);
            return (
              <CommandItem
                key={agent.id}
                value={agent.id}
                keywords={[agent.name, agent.description, agent.category]}
                onSelect={() => onToggle(agent.id)}
                className={isSelected ? 'bg-secondary/50' : ''}
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
                {/* Selected checkmark */}
                {isSelected && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </>
  );
}
