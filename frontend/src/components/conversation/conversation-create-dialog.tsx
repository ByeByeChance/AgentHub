'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X, MessageSquare, Users } from 'lucide-react';

interface ConversationCreateDialogProps {
  children: ReactNode;
}

export function ConversationCreateDialog({
  children,
}: ConversationCreateDialogProps) {
  const t = useTranslations('conversation');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'single' | 'group'>('single');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  const agentsMap = useStore((s) => s.agents);
  const agents = useMemo(() => Object.values(agentsMap), [agentsMap]);
  const fetchAgents = useStore((s) => s.fetchAgents);
  const createConversation = useStore((s) => s.createConversation);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async () => {
    if (selectedAgentIds.length === 0) return;
    await createConversation({
      title: title || undefined,
      mode,
      agentIds: selectedAgentIds,
    });
    setOpen(false);
    setTitle('');
    setSelectedAgentIds([]);
  };

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id)
        ? prev.filter((a) => a !== id)
        : mode === 'single'
          ? [id]
          : [...prev, id],
    );
  };

  const selectedAgents = agents.filter((a) =>
    selectedAgentIds.includes(a.id),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('newConversationTitle')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('titleOptional')}</Label>
            <Input
              id="title"
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label>{t('mode')}</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as 'single' | 'group');
                if (v === 'single') {
                  setSelectedAgentIds((prev) =>
                    prev.length > 1 ? [prev[0]!] : prev,
                  );
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" /> {t('singleAgent')}
                  </span>
                </SelectItem>
                <SelectItem value="group">
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> {t('groupChat')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selected agents */}
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

          {/* Agent list */}
          <div className="space-y-2">
            <Label>
              {mode === 'group' ? t('selectAgents') : t('selectAgent')}
            </Label>
            <ScrollArea className="h-48 border border-border/50 rounded-xl">
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
                        <p className="text-sm font-medium truncate">
                          {agent.name}
                        </p>
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
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selectedAgentIds.length === 0}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {t('create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
