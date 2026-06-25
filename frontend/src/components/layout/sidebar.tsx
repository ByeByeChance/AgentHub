'use client';

import { MessageSquare, Bot, Settings, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStore } from '@/store/index';
import { Link } from '@/i18n/navigation';

interface NavItem {
  icon: LucideIcon;
  label: string;
  tab: 'chat' | 'agents' | 'settings';
  href: string;
}

export function Sidebar() {
  const t = useTranslations('sidebar');
  const sidebarTab = useStore((s) => s.ui.sidebarTab);

  const navItems: NavItem[] = [
    { icon: MessageSquare, label: t('chat'), tab: 'chat', href: '/chat' },
    { icon: Bot, label: t('agents'), tab: 'agents', href: '/agents' },
    { icon: Settings, label: t('settings'), tab: 'settings', href: '/settings' },
  ];

  return (
    <aside className="flex flex-col items-center w-16 h-full bg-card border-r border-border py-3 gap-1">
      {/* Logo */}
      <Link href="/chat" className="mb-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent text-accent-foreground font-bold text-sm shadow-sm press-scale interactive">
          AH
        </div>
      </Link>

      {/* Nav items */}
      {navItems.map((item) => {
        const isActive = sidebarTab === item.tab;
        return (
          <Tooltip key={item.tab}>
            <TooltipTrigger asChild>
              <Link href={item.href}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="icon"
                  className="w-10 h-10 rounded-xl interactive press-scale"
                  aria-label={item.label}
                >
                  <item.icon className="w-5 h-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="animate-fade-in-right">
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* SSE status indicator */}
      <SSEIndicator />
    </aside>
  );
}

function SSEIndicator() {
  const t = useTranslations('sidebar');
  const status = useStore((s) => s.ui.globalSSEStatus);

  const color =
    status === 'connected'
      ? 'bg-success shadow-[0_0_6px_hsl(var(--success)/0.5)]'
      : status === 'connecting'
        ? 'bg-warning animate-pulse'
        : 'bg-destructive';

  const statusLabel =
    status === 'connected'
      ? t('sseConnected')
      : status === 'connecting'
        ? t('sseConnecting')
        : t('sseDisconnected');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-10 h-10 flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full interactive ${color}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{t('sseStatus', { status: statusLabel })}</TooltipContent>
    </Tooltip>
  );
}
