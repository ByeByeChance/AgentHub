'use client';

import { useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useStore } from '@/store/index';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor } from 'lucide-react';

const STORAGE_KEY = 'agenthub-theme';

function resolveTheme(t: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (t === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return t;
}

export function ThemeToggle() {
  const t = useTranslations('settings');
  const theme = useStore((s) => s.settings.theme);
  const setTheme = useStore((s) => s.setTheme);

  const THEMES = [
    { key: 'light' as const, icon: Sun, label: t('light') },
    { key: 'dark' as const, icon: Moon, label: t('dark') },
    { key: 'system' as const, icon: Monitor, label: t('system') },
  ] as const;

  // Sync theme on mount (handles hydration from ThemeInitScript)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | 'system' | null;
      if (stored && stored !== theme) {
        setTheme(stored);
      }
    } catch {
      // localStorage unavailable — store state is source of truth
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const applyTheme = useCallback(
    (themeKey: 'light' | 'dark' | 'system') => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(resolveTheme(themeKey));
      setTheme(themeKey);
      try {
        localStorage.setItem(STORAGE_KEY, themeKey);
      } catch {
        // localStorage unavailable
      }
    },
    [setTheme],
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t('theme')}</h3>
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {THEMES.map(({ key, icon: Icon, label }) => (
          <Button
            key={key}
            variant={theme === key ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 h-8 press-scale interactive"
            onClick={() => applyTheme(key)}
            aria-pressed={theme === key}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
