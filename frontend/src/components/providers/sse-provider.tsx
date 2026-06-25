'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSSE } from '@/hooks/use-sse';

interface SSEContextValue {
  status: 'connecting' | 'connected' | 'disconnected';
  reconnect: () => void;
}

const SSEContext = createContext<SSEContextValue>({
  status: 'disconnected',
  reconnect: () => {},
});

export function useSSEContext(): SSEContextValue {
  return useContext(SSEContext);
}

export function SSEProvider({ children }: { children: ReactNode }) {
  const { status, reconnect } = useSSE({ enabled: true });

  const value = useMemo(() => ({ status, reconnect }), [status, reconnect]);

  return (
    <SSEContext.Provider value={value}>
      {children}
    </SSEContext.Provider>
  );
}
