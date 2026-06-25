'use client';

import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { useAgentDetail } from '@/store/selectors/agent-selectors';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArtifactPreview } from '@/components/artifact/artifact-preview';
import { X, Bot, FolderOpen } from 'lucide-react';

export function DetailPanel() {
  const t = useTranslations('detailPanel');
  const isOpen = useStore((s) => s.ui.isDetailPanelOpen);
  const tab = useStore((s) => s.ui.detailPanelTab);
  const activeConversationId = useStore((s) => s.ui.activeConversationId);
  const selectedArtifactId = useStore((s) => s.ui.selectedArtifactId);
  const setDetailPanelOpen = useStore((s) => s.setDetailPanelOpen);
  const setDetailPanelTab = useStore((s) => s.setDetailPanelTab);

  const activeAgentId = useStore((s) => s.ui.activeAgentId);
  const conversation = useStore((s) =>
    activeConversationId ? s.conversations[activeConversationId] : null,
  );
  const agentId = activeAgentId ?? conversation?.agentIds[0] ?? null;
  const agent = useAgentDetail(agentId);

  const artifact = useStore((s) =>
    selectedArtifactId ? s.artifacts[selectedArtifactId] : null,
  );

  if (!isOpen) return null;

  return (
    <aside className="flex flex-col w-96 border-l border-border bg-card h-full animate-fade-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setDetailPanelTab('agent')}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md interactive ${
              tab === 'agent'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            {t('agent')}
          </button>
          <button
            onClick={() => setDetailPanelTab('artifacts')}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md interactive ${
              tab === 'artifacts'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {t('artifacts')}
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 rounded-lg interactive"
          onClick={() => setDetailPanelOpen(false)}
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === 'agent' && (
            <div className="space-y-4 animate-fade-in-up">
              {agent ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-2xl shadow-sm ring-1 ring-border/50">
                      {agent.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{agent.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {agent.category}
                        {agent.isBuiltin ? ` · ${t('builtIn')}` : ` · ${t('custom')}`}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {agent.description}
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('model')}
                    </h4>
                    <div className="bg-muted/50 rounded-lg px-3 py-2">
                      <p className="text-sm font-medium">
                        {agent.adapterName} / {agent.modelId}
                      </p>
                    </div>
                  </div>
                  {agent.toolNames.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('tools')}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.toolNames.map((tool) => (
                          <span
                            key={tool}
                            className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-lg font-medium"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('systemPrompt')}
                    </h4>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed border border-border/50">
                      {agent.systemPrompt}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('noAgentSelected')}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'artifacts' && (
            <div className="space-y-4 animate-fade-in-up">
              {artifact ? (
                <ArtifactPreview artifact={artifact} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t('noAgentSelected')}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
                    {t('noArtifactSelected')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
