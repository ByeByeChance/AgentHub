'use client';

import Link from 'next/link';
import type { AgentMetadata } from '@/store/interfaces';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface AgentCardProps {
  agent: AgentMetadata;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <span className="text-2xl">{agent.emoji}</span>
            <Badge variant={agent.isBuiltin ? 'secondary' : 'outline'} className="text-xs">
              {agent.isBuiltin ? 'Built-in' : 'Custom'}
            </Badge>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm truncate">{agent.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {agent.description}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {agent.category}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
}
