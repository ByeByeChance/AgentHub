import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-CN', 'en'],
  defaultLocale: 'zh-CN',
  localePrefix: 'never',
  localeCookie: {
    maxAge: 365 * 24 * 60 * 60, // 1 year persistence
  },
});
