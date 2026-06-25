'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2, XCircle, ArrowRight } from 'lucide-react';

interface PlanTask {
  id: string;
  agentId: string;
  input: string;
  dependsOn: string[];
  status?: 'pending' | 'running' | 'complete' | 'failed';
}

interface PlanVisualizationProps {
  tasks: PlanTask[];
  strategy: 'dag' | 'sequential' | 'parallel';
  agentNames?: Record<string, string>;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="w-4 h-4 text-muted-foreground" />,
  running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  complete: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
};

function getTaskStatus(task: PlanTask): string {
  return task.status ?? 'pending';
}

export function PlanVisualization({ tasks, strategy, agentNames }: PlanVisualizationProps) {
  const t = useTranslations('orchestrator');

  if (tasks.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {t('noTasks')}
      </div>
    );
  }

  // Sort tasks so dependencies come first (topological-ish)
  const sorted = [...tasks].sort((a, b) => {
    if (a.dependsOn.includes(b.id)) return 1;
    if (b.dependsOn.includes(a.id)) return -1;
    return 0;
  });

  const strategyLabel =
    strategy === 'dag' ? t('dag') : strategy === 'sequential' ? t('sequential') : t('parallel');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {strategyLabel}
        </Badge>
        <span>{t('tasks', { count: tasks.length })}</span>
        <span>·</span>
        <span>{t('done', { count: tasks.filter((t) => t.status === 'complete').length })}</span>
      </div>

      <div className="space-y-1.5">
        {sorted.map((task, idx) => {
          const status = getTaskStatus(task);
          const agentName = agentNames?.[task.agentId] ?? task.agentId;

          return (
            <div key={task.id}>
              {/* Dependency arrows for DAG */}
              {strategy === 'dag' && task.dependsOn.length > 0 && (
                <div className="flex items-center gap-1 ml-4 mb-0.5">
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50 rotate-45" />
                  <span className="text-[10px] text-muted-foreground/50">
                    {t('dependsOn')}: {task.dependsOn.join(', ')}
                  </span>
                </div>
              )}

              <div
                className={`flex items-start gap-3 p-2.5 rounded-md border transition-colors ${
                  status === 'running'
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                    : status === 'complete'
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                      : status === 'failed'
                        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                        : 'border-border bg-card'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {STATUS_ICONS[status] ?? STATUS_ICONS['pending']}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-muted-foreground">
                      {task.id}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {agentName}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">
                    {typeof task.input === 'string' ? task.input : JSON.stringify(task.input)}
                  </p>
                </div>
              </div>

              {/* Sequential arrow between tasks */}
              {strategy === 'sequential' && idx < sorted.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
