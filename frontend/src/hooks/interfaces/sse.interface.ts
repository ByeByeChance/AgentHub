export interface UseSSEOptions {
  enabled?: boolean;
}

export interface UseSSEReturn {
  status: 'connecting' | 'connected' | 'disconnected';
  reconnect: () => void;
}
