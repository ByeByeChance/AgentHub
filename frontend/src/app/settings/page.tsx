'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/index';
import { ApiKeyManager } from '@/components/settings/api-key-manager';

export default function SettingsPage() {
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  useEffect(() => {
    setSidebarTab('settings');
  }, [setSidebarTab]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your API keys and preferences
          </p>
        </div>

        <ApiKeyManager />
      </div>
    </div>
  );
}
