'use client';

import type { AgentMetadata } from '@/store/interfaces';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AgentSwitcherProps {
  agents: AgentMetadata[];
  activeAgentId: string | null;
  onAgentChange: (agentId: string) => void;
  defaultLabel?: string;
}

/**
 * Agent switcher dropdown for the chat header.
 * When there's only one agent, shows just the name (no dropdown).
 */
export function AgentSwitcher({
  agents,
  activeAgentId,
  onAgentChange,
  defaultLabel,
}: AgentSwitcherProps) {
  if (agents.length === 0) return null;

  if (agents.length === 1) {
    return (
      <p className="text-xs text-muted-foreground">
        {agents[0]?.name ?? defaultLabel}
      </p>
    );
  }

  return (
    <Select value={activeAgentId ?? ''} onValueChange={onAgentChange}>
      <SelectTrigger className="h-6 text-xs border-0 bg-transparent px-0 gap-1 min-w-0 w-auto interactive">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.emoji} {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
