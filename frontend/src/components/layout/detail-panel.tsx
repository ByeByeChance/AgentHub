'use client';

import { useStore } from '@/store/index';
import { useAgentDetail } from '@/store/selectors/agent-selectors';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArtifactPreview } from '@/components/artifact/artifact-preview';
import { X } from 'lucide-react';

export function DetailPanel() {
  const isOpen = useStore((s) => s.ui.isDetailPanelOpen);
  const tab = useStore((s) => s.ui.detailPanelTab);
  const activeConversationId = useStore((s) => s.ui.activeConversationId);
  const selectedArtifactId = useStore((s) => s.ui.selectedArtifactId);
  const setDetailPanelOpen = useStore((s) => s.setDetailPanelOpen);
  const setDetailPanelTab = useStore((s) => s.setDetailPanelTab);

  const conversation = useStore((s) =>
    activeConversationId ? s.conversations[activeConversationId] : null,
  );
  const agentId = conversation?.agentIds[0] ?? null;
  const agent = useAgentDetail(agentId);

  const artifact = useStore((s) =>
    selectedArtifactId ? s.artifacts[selectedArtifactId] : null,
  );

  if (!isOpen) return null;

  return (
    <aside className="flex flex-col w-96 border-l border-border bg-background h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDetailPanelTab('agent')}
            className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
              tab === 'agent'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Agent
          </button>
          <button
            onClick={() => setDetailPanelTab('artifacts')}
            className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
              tab === 'artifacts'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Artifacts
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={() => setDetailPanelOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {tab === 'agent' && (
          <div className="space-y-4">
            {agent ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{agent.emoji}</span>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {agent.category}
                      {agent.isBuiltin ? ' · Built-in' : ' · Custom'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {agent.description}
                </p>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Model
                  </h4>
                  <p className="text-sm">
                    {agent.adapterName} / {agent.modelId}
                  </p>
                </div>
                {agent.toolNames.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tools
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {agent.toolNames.map((t) => (
                        <span
                          key={t}
                          className="text-xs bg-muted px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    System Prompt
                  </h4>
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
                    {agent.systemPrompt}
                  </pre>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No agent selected
              </p>
            )}
          </div>
        )}

        {tab === 'artifacts' && (
          <div className="space-y-4">
            {artifact ? (
              <ArtifactPreview artifact={artifact} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No artifact selected. Click an artifact reference in the
                chat to preview it here.
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
