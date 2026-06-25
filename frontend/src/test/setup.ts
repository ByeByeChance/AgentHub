import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock next-intl for tests
vi.mock('next-intl', () => ({
  useTranslations:
    (_namespace: string) =>
    (key: string, params?: Record<string, unknown>) => {
      if (params) {
        return `${key}(${JSON.stringify(params)})`;
      }
      return key;
    },
  useFormatter: () => ({
    relativeTime: (date: Date | number, now?: Date | number) => {
      const d = date instanceof Date ? date : new Date(date);
      const n = now instanceof Date ? now : now ? new Date(now) : new Date();
      const diffMs = n.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      return d.toLocaleDateString();
    },
    dateTime: (date: Date | number) => {
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString();
    },
  }),
  useNow: () => new Date('2026-06-25T12:00:00Z'),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  hasLocale: () => true,
  setRequestLocale: () => {},
  getTranslations: async () => (key: string) => key,
}));

vi.mock('next-intl/server', () => ({
  getRequestConfig: () => () => ({ locale: 'en', messages: {} }),
  getTranslations: async () => (key: string) => key,
  setRequestLocale: () => {},
}));

vi.mock('next-intl/navigation', () => ({
  createNavigation: () => ({
    Link: 'a',
    redirect: () => {},
    usePathname: () => '/en/chat',
    useRouter: () => ({ push: () => {}, replace: () => {} }),
    getPathname: () => '/en/chat',
  }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: 'a',
  redirect: () => {},
  usePathname: () => '/en/chat',
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  getPathname: () => '/en/chat',
}));

vi.mock('@/i18n/routing', () => ({
  routing: {
    locales: ['zh-CN', 'en'],
    defaultLocale: 'zh-CN',
  },
}));
