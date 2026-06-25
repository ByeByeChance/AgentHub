import { redirect } from 'next/navigation';
import { routing } from '@/i18n/routing';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = routing.locales.includes(locale as 'zh-CN' | 'en')
    ? locale
    : routing.defaultLocale;
  redirect(`/${l}/chat`);
}
