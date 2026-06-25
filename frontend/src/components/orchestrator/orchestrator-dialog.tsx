'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { useFilteredAgents } from '@/store/selectors/agent-selectors';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormDialog } from '@/components/ui/form-dialog';
import { DialogFormField } from '@/components/ui/dialog-form-field';
import { AgentSelector } from '@/components/shared/agent-selector';
import { FOCUS_CLASS } from '@/lib/style-constants';
import { parseSSEStream } from '@/lib/stream-parser';
import { apiClient } from '@/lib/api-client';
import type { EventEnvelope } from '@/lib/constants';
import { Network, Play, ListOrdered, ArrowLeftRight, Loader2 } from 'lucide-react';

interface OrchestratorDialogProps {
  conversationId: string;
}

const MODE_ICONS: Record<'dag' | 'sequential' | 'parallel', ReactNode> = {
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

  const handleExecute = async () => {
    if (!goal.trim() || selectedAgentIds.length === 0) return;
    setIsRunning(true);

    try {
      const stream = await apiClient.streamPost(
        `/api/conversations/${conversationId}/execute`,
        {
          goal: goal.trim(),
          agents: selectedAgentIds.map((id) => ({
            id,
            name: agents.find((a) => a.id === id)?.name ?? id,
          })),
          mode,
        },
      );

      await parseSSEStream(stream, (event: EventEnvelope) => {
        useStore.getState().dispatchStreamEvent(event);
      });
    } catch (err) {
      console.error('Orchestrator execution error', err);
    } finally {
      setIsRunning(false);
      setOpen(false);
      setGoal('');
      setSelectedAgentIds([]);
    }
  };

  const titleNode = (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
        <Network className="w-3.5 h-3.5 text-accent" />
      </div>
      <span>{t('title')}</span>
    </div>
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={titleNode}
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs rounded-lg interactive press-scale"
          disabled={isRunning}
        >
          <Network className="w-3.5 h-3.5" />
          {t('orchestrate')}
        </Button>
      }
      cancelLabel={t('cancel')}
      submitLabel={
        isRunning ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('running')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Play className="w-4 h-4" />
            {t('executePlan')}
          </span>
        )
      }
      onSubmit={handleExecute}
      submitDisabled={!goal.trim() || selectedAgentIds.length === 0}
      submitLoading={isRunning}
      maxWidth="xl"
      className="p-6 gap-4"
    >
      {/* Goal */}
      <DialogFormField label={t('goal')} htmlFor="goal">
        <Textarea
          id="goal"
          placeholder={t('goalPlaceholder')}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className={`min-h-[80px] resize-none text-sm rounded-xl ${FOCUS_CLASS}`}
          disabled={isRunning}
        />
      </DialogFormField>

      {/* Mode */}
      <DialogFormField label={t('executionMode')}>
        <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <SelectTrigger className={`rounded-lg w-full h-9 text-sm ${FOCUS_CLASS}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0">{MODE_ICONS[mode]}</span>
              <span className="truncate">
                <SelectValue />
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dag">{t('dagDesc')}</SelectItem>
            <SelectItem value="sequential">{t('sequentialDesc')}</SelectItem>
            <SelectItem value="parallel">{t('parallelDesc')}</SelectItem>
          </SelectContent>
        </Select>
      </DialogFormField>

      {/* Agent selection */}
      <DialogFormField
        label={t('selectAgents', { count: selectedAgentIds.length })}
      >
        <AgentSelector
          agents={agents}
          selectedIds={selectedAgentIds}
          onToggle={toggleAgent}
        />
      </DialogFormField>
    </FormDialog>
  );
}
