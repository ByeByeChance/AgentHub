'use client';

import { useState, useEffect, type ReactNode } from 'react';
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
import { X } from 'lucide-react';

interface ConversationCreateDialogProps {
  children: ReactNode;
}

export function ConversationCreateDialog({
  children,
}: ConversationCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'single' | 'group'>('single');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

  const agents = useStore((s) => Object.values(s.agents));
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
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder="Conversation title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label>Mode</Label>
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
                <SelectItem value="single">Single Agent</SelectItem>
                <SelectItem value="group">Group Chat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selected agents */}
          {selectedAgents.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedAgents.map((a) => (
                <Badge
                  key={a.id}
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => toggleAgent(a.id)}
                >
                  {a.emoji} {a.name}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
            </div>
          )}

          {/* Agent list */}
          <div className="space-y-2">
            <Label>Select Agent{ mode === 'group' ? 's' : ''}</Label>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {agents.map((agent) => {
                  const isSelected = selectedAgentIds.includes(agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <span className="text-xl">{agent.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {agent.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {agent.description}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {agent.category}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selectedAgentIds.length === 0}
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
