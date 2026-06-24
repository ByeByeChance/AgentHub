'use client';

import { useState } from 'react';
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
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';

const PROVIDERS = ['deepseek', 'anthropic', 'openai'] as const;

export function ApiKeyManager() {
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
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <CardDescription>
          Manage your LLM provider API keys. Keys are stored locally in
          your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new key */}
        <div className="flex items-end gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1 space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider..." />
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
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
              <Button onClick={handleAdd} disabled={!provider || !key} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Key list */}
        <div className="space-y-2">
          {apiKeys.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No API keys configured. Add one to get started.
            </p>
          )}
          {apiKeys.map((entry) => (
            <div
              key={entry.provider}
              className="flex items-center justify-between p-3 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  {entry.provider.charAt(0).toUpperCase() +
                    entry.provider.slice(1)}
                </Badge>
                <code className="text-sm font-mono">
                  {showKey[entry.provider]
                    ? entry.keyPrefix
                    : '••••••••••••'}
                </code>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={() => toggleShow(entry.provider)}
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
                  className="w-7 h-7 text-destructive hover:text-destructive"
                  onClick={() => removeApiKey(entry.provider)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          ⚠️ API keys are stored in your browser&apos;s local storage. For
          production use, keys should be stored server-side.
        </p>
      </CardContent>
    </Card>
  );
}
