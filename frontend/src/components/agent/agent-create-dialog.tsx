'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { Input } from '@/components/ui/input';
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
    setName('');
    setEmoji('');
    setDescription('');
    setCategory('');
    setNewCategory('');
    setSystemPrompt('');
  };

  const isValid = name && emoji && description && (category || newCategory) && systemPrompt;

  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      title={t('createCustomAgent')}
      trigger={children}
      cancelLabel={t('cancel')}
      submitLabel={t('createAgentButton')}
      onSubmit={handleCreate}
      submitDisabled={!isValid}
    >
      <div className="grid grid-cols-4 gap-3">
        <DialogFormField label={t('emoji')} htmlFor="emoji" className="col-span-1">
          <Input
            id="emoji"
            placeholder="🤖"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
            className="text-center text-xl"
          />
        </DialogFormField>
        <DialogFormField label={t('name')} htmlFor="name" className="col-span-3">
          <Input
            id="name"
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </DialogFormField>
      </div>

      <DialogFormField label={t('description')} htmlFor="description">
        <Input
          id="description"
          placeholder={t('descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </DialogFormField>

      <DialogFormField label={t('category')}>
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
          className="text-sm mt-2"
        />
      </DialogFormField>

      <DialogFormField label={t('systemPrompt')} htmlFor="systemPrompt">
        <Textarea
          id="systemPrompt"
          placeholder={t('systemPromptPlaceholder')}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="min-h-[100px]"
          rows={5}
        />
      </DialogFormField>
    </FormDialog>
  );
}
