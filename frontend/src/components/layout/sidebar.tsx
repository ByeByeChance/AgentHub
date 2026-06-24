'use client';

import { MessageSquare, Bot, Settings, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStore } from '@/store/index';
import Link from 'next/link';

interface NavItem {
  icon: LucideIcon;
  label: string;
  tab: 'chat' | 'agents' | 'settings';
  href: string;
}

const navItems: NavItem[] = [
  { icon: MessageSquare, label: 'Chat', tab: 'chat', href: '/chat' },
  { icon: Bot, label: 'Agents', tab: 'agents', href: '/agents' },
  { icon: Settings, label: 'Settings', tab: 'settings', href: '/settings' },
];

export function Sidebar() {
  const sidebarTab = useStore((s) => s.ui.sidebarTab);

  return (
    <aside className="flex flex-col items-center w-16 h-full bg-muted/50 border-r border-border py-3 gap-1">
      {/* Logo */}
      <div className="mb-3 flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm">
        AH
      </div>

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
                  className="w-10 h-10"
                  aria-label={item.label}
                >
                  <item.icon className="w-5 h-5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
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
  const status = useStore((s) => s.ui.globalSSEStatus);

  const color =
    status === 'connected'
      ? 'bg-green-500'
      : status === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-10 h-10 flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full ${color}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">SSE: {status}</TooltipContent>
    </Tooltip>
  );
}
