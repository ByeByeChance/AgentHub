'use client';

import { useState, type ReactNode } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgentCategories } from '@/store/selectors/agent-selectors';

interface AgentCreateDialogProps {
  children: ReactNode;
}

export function AgentCreateDialog({ children }: AgentCreateDialogProps) {
  const t = useTranslations('agent');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const createAgent = useStore((s) => s.createAgent);
  const existingCategories = useAgentCategories();

  const allCategories = [...existingCategories];
  if (newCategory && !allCategories.includes(newCategory)) {
    allCategories.push(newCategory);
  }

  const handleCreate = async () => {
    const finalCategory = category || newCategory;
    if (!name || !emoji || !description || !finalCategory || !systemPrompt)
      return;

    await createAgent({
      name,
      emoji,
      description,
      category: finalCategory,
      systemPrompt,
    });
    setOpen(false);
    setName('');
    setEmoji('');
    setDescription('');
    setCategory('');
    setNewCategory('');
    setSystemPrompt('');
  };

  const isValid = name && emoji && description && (category || newCategory) && systemPrompt;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createCustomAgent')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2 col-span-1">
              <Label htmlFor="emoji">{t('emoji')}</Label>
              <Input
                id="emoji"
                placeholder="🤖"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
                className="text-center text-xl"
              />
            </div>
            <div className="space-y-2 col-span-3">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Input
              id="description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t('category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {existingCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('newCategory')}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">{t('systemPrompt')}</Label>
            <Textarea
              id="systemPrompt"
              placeholder={t('systemPromptPlaceholder')}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-[100px]"
              rows={5}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!isValid}>
              {t('createAgentButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
