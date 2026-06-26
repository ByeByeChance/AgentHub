'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

interface LocaleOption {
  key: 'zh-CN' | 'en';
  label: string;
}

export function LocaleSwitcher() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const locales: LocaleOption[] = [
    { key: 'zh-CN', label: t('chinese') },
    { key: 'en', label: t('english') },
  ];

  const handleSwitch = (targetLocale: 'zh-CN' | 'en') => {
    router.replace(pathname, { locale: targetLocale });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t('language')}</h3>
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {locales.map(({ key, label }) => (
          <Button
            key={key}
            variant={locale === key ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 h-8 press-scale interactive"
            onClick={() => handleSwitch(key)}
            aria-pressed={locale === key}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
