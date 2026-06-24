'use client';

import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';

interface AppShellProps {
  sidebar?: ReactNode;
  children: ReactNode;
}

export function AppShell({ children, sidebar }: AppShellProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      {sidebar ?? <Sidebar />}
      {children}
    </div>
  );
}
