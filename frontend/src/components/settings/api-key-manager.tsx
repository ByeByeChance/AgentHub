'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, EyeOff, Key, Shield } from 'lucide-react';

const PROVIDERS = ['deepseek', 'anthropic', 'openai'] as const;

export function ApiKeyManager() {
  const t = useTranslations('settings');
  const apiKeys = useStore((s) => s.settings.apiKeys);
  const addApiKey = useStore((s) => s.addApiKey);
  const removeApiKey = useStore((s) => s.removeApiKey);

  const [provider, setProvider] = useState<string>('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const handleAdd = () => {
    if (!provider || !key) return;
    addApiKey({
      provider,
      keyPrefix: `${key.slice(0, 4)}****${key.slice(-4)}`,
      createdAt: new Date().toISOString(),
    });
    setProvider('');
    setKey('');
  };

  const toggleShow = (providerName: string) => {
    setShowKey((prev) => ({ ...prev, [providerName]: !prev[providerName] }));
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle>{t('apiKeys')}</CardTitle>
            <CardDescription>
              {t('apiKeysDesc')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new key */}
        <div className="flex items-end gap-3 p-4 bg-muted/40 rounded-xl border border-border/30">
          <div className="flex-1 space-y-2">
            <Label htmlFor="provider">{t('provider')}</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider" className="rounded-lg">
                <SelectValue placeholder={t('selectProvider')} />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-[2] space-y-2">
            <Label htmlFor="apiKey">{t('apiKey')}</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="rounded-lg"
              />
              <Button
                onClick={handleAdd}
                disabled={!provider || !key}
                size="icon"
                className="rounded-xl press-scale interactive"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Key list */}
        <div className="space-y-2">
          {apiKeys.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('noKeys')}
              </p>
            </div>
          )}
          {apiKeys.map((entry) => (
            <div
              key={entry.provider}
              className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card interactive hover:border-border"
            >
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="rounded-lg font-medium">
                  {entry.provider.charAt(0).toUpperCase() +
                    entry.provider.slice(1)}
                </Badge>
                <code className="text-sm font-mono text-muted-foreground">
                  {showKey[entry.provider]
                    ? entry.keyPrefix
                    : '••••••••••••'}
                </code>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-lg interactive"
                  onClick={() => toggleShow(entry.provider)}
                  aria-label={showKey[entry.provider] ? 'Hide key' : 'Show key'}
                >
                  {showKey[entry.provider] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 rounded-lg interactive text-destructive hover:text-destructive"
                  onClick={() => removeApiKey(entry.provider)}
                  aria-label={`Remove ${entry.provider} key`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <Shield className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t('storageWarning')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
