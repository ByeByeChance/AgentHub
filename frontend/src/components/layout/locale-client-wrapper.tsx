'use client';

import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

/**
 * Thin client boundary that wraps all locale-scoped routes in AppShell.
 * This ensures the Sidebar persists across ALL route navigations
 * (chat, agents, settings) without re-mounting.
 *
 * Must be a client component because AppShell reads from Zustand store.
 */
export function LocaleClientWrapper({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
