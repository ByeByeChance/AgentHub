'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { ApiKeyManager } from '@/components/settings/api-key-manager';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { LocaleSwitcher } from '@/components/settings/locale-switcher';
import { Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  useEffect(() => {
    setSidebarTab('settings');
  }, [setSidebarTab]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 animate-fade-in-down">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Theme & Language */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm animate-fade-in-up space-y-6">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>

        {/* API Keys */}
        <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <ApiKeyManager />
        </div>
      </div>
    </div>
  );
}
