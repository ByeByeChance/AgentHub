'use client';

import { createContext, useContext, type ReactNode } from 'react';
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

  return (
    <SSEContext.Provider value={{ status, reconnect }}>
      {children}
    </SSEContext.Provider>
  );
}
