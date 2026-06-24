'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/store/index';
import { useAgentDetail } from '@/store/selectors/agent-selectors';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AgentProfile() {
  const { agentId } = useParams<{ agentId: string }>();
  const fetchAgentDetail = useStore((s) => s.fetchAgentDetail);
  const agent = useAgentDetail(agentId ?? null);

  useEffect(() => {
    if (agentId) {
      void fetchAgentDetail(agentId);
    }
  }, [agentId, fetchAgentDetail]);

  if (!agent) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/agents">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </Button>
      </Link>

      <div className="flex items-start gap-4">
        <span className="text-4xl">{agent.emoji}</span>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="text-muted-foreground">{agent.description}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{agent.category}</Badge>
            <Badge variant={agent.isBuiltin ? 'secondary' : 'outline'}>
              {agent.isBuiltin ? 'Built-in' : 'Custom'}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Model</h3>
            <p className="text-sm text-muted-foreground">
              {agent.adapterName} / {agent.modelId}
            </p>
          </div>

          {agent.toolNames.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Tools</h3>
              <div className="flex flex-wrap gap-1">
                {agent.toolNames.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold mb-1">System Prompt</h3>
            <pre className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
              {agent.systemPrompt}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
