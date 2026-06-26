'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useStore } from '@/store/index';
import { Input } from '@/components/ui/input';
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
import { MessageSquare, Users } from 'lucide-react';

interface ConversationCreateDialogProps {
  children: ReactNode;
}

const MODE_OPTIONS = [
  { value: 'single', icon: MessageSquare, labelKey: 'singleAgent' as const },
  { value: 'group', icon: Users, labelKey: 'groupChat' as const },
];

export function ConversationCreateDialog({
  children,
}: ConversationCreateDialogProps) {
  const t = useTranslations('conversation');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'single' | 'group'>('single');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  const agentsMap = useStore((s) => s.agents);
  const agents = useMemo(() => Object.values(agentsMap), [agentsMap]);
  const fetchAgents = useStore((s) => s.fetchAgents);
  const createConversation = useStore((s) => s.createConversation);

  useEffect(() => {
    if (open) fetchAgents(undefined, undefined, locale);
  }, [open, fetchAgents, locale]);

  const handleCreate = async () => {
    if (selectedAgentIds.length === 0) return;
    await createConversation({
      title: title || undefined,
      mode,
      agentIds: selectedAgentIds,
    });
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

  const ModeIcon = MODE_OPTIONS.find((o) => o.value === mode)?.icon ?? MessageSquare;

  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={t('newConversationTitle')}
      trigger={children}
      cancelLabel={t('cancel')}
      submitLabel={t('create')}
      onSubmit={handleCreate}
      submitDisabled={selectedAgentIds.length === 0}
      className="p-6 gap-4"
    >
      {/* Title */}
      <DialogFormField label={t('titleOptional')} htmlFor="title">
        <Input
          id="title"
          placeholder={t('titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`rounded-lg h-9 text-sm ${FOCUS_CLASS}`}
        />
      </DialogFormField>

      {/* Mode */}
      <DialogFormField label={t('mode')}>
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
          <SelectTrigger className={`rounded-lg w-full h-9 text-sm ${FOCUS_CLASS}`}>
            <div className="flex items-center gap-2 min-w-0">
              <ModeIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">
                <SelectValue />
              </span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {MODE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogFormField>

      {/* Agent selection */}
      <DialogFormField
        label={mode === 'group' ? t('selectAgents') : t('selectAgent')}
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
