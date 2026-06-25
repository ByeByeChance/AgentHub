'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { useFilteredAgents } from '@/store/selectors/agent-selectors';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Play, Network, ListOrdered, ArrowLeftRight, Loader2 } from 'lucide-react';

interface OrchestratorDialogProps {
  conversationId: string;
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  dag: <Network className="w-4 h-4" />,
  sequential: <ListOrdered className="w-4 h-4" />,
  parallel: <ArrowLeftRight className="w-4 h-4" />,
};

export function OrchestratorDialog({ conversationId }: OrchestratorDialogProps) {
  const t = useTranslations('orchestrator');
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<'dag' | 'sequential' | 'parallel'>('dag');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const agents = useFilteredAgents();

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const selectedAgents = useMemo(
    () => agents.filter((a) => selectedAgentIds.includes(a.id)),
    [agents, selectedAgentIds],
  );

  const handleExecute = async () => {
    if (!goal.trim() || selectedAgentIds.length === 0) return;
    setIsRunning(true);

    try {
      const body = JSON.stringify({
        goal: goal.trim(),
        agents: selectedAgentIds.map((id) => ({
          id,
          name: agents.find((a) => a.id === id)?.name ?? id,
        })),
        mode,
      });

      const response = await fetch(
        `/api/conversations/${conversationId}/execute`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
      );

      if (!response.ok) {
        console.error('Orchestrator execution failed', response.status);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              useStore.getState().dispatchStreamEvent(event);
            } catch { /* skip unparseable lines */ }
          }
        }
      }
    } catch (err) {
      console.error('Orchestrator execution error', err);
    } finally {
      setIsRunning(false);
      setOpen(false);
      setGoal('');
      setSelectedAgentIds([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs rounded-lg interactive press-scale"
          disabled={isRunning}
        >
          <Network className="w-3.5 h-3.5" />
          {t('orchestrate')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Network className="w-4 h-4 text-accent" />
            </div>
            <DialogTitle>{t('title')}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Goal */}
          <div className="space-y-2">
            <Label htmlFor="goal">{t('goal')}</Label>
            <Textarea
              id="goal"
              placeholder={t('goalPlaceholder')}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-[80px] resize-none text-sm rounded-xl"
              disabled={isRunning}
            />
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label>{t('executionMode')}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger className="text-sm rounded-lg">
                <div className="flex items-center gap-2">
                  {MODE_ICONS[mode]}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dag">
                  <span className="flex items-center gap-2">
                    <Network className="w-4 h-4" /> {t('dagDesc')}
                  </span>
                </SelectItem>
                <SelectItem value="sequential">
                  <span className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4" /> {t('sequentialDesc')}
                  </span>
                </SelectItem>
                <SelectItem value="parallel">
                  <span className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" /> {t('parallelDesc')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent selection */}
          <div className="space-y-2">
            <Label>{t('selectAgents', { count: selectedAgentIds.length })}</Label>
            {selectedAgents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedAgents.map((a) => (
                  <Badge
                    key={a.id}
                    variant="secondary"
                    className="gap-1.5 cursor-pointer interactive pl-2 pr-1.5 py-1"
                    onClick={() => toggleAgent(a.id)}
                  >
                    {a.emoji} {a.name}
                    <X className="w-3 h-3 ml-0.5" />
                  </Badge>
                ))}
              </div>
            )}
            <ScrollArea className="h-40 border border-border/50 rounded-xl">
              <div className="p-1.5 space-y-0.5">
                {agents.map((agent) => {
                  const isSelected = selectedAgentIds.includes(agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer interactive ${
                        isSelected
                          ? 'bg-secondary text-secondary-foreground ring-1 ring-border/50'
                          : 'hover:bg-muted/70'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg flex-shrink-0">
                        {agent.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {agent.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {agent.category}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isRunning}>
              {t('cancel')}
            </Button>
            <Button
              onClick={() => void handleExecute()}
              disabled={!goal.trim() || selectedAgentIds.length === 0 || isRunning}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-1.5" />
              )}
              {isRunning ? t('running') : t('executePlan')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
