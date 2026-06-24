'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/index';
import { logger } from '@/lib/logger';

interface UseSSEOptions {
  enabled?: boolean;
}

interface UseSSEReturn {
  status: 'connecting' | 'connected' | 'disconnected';
  reconnect: () => void;
}

/**
 * Global SSE hook — connects to /api/events and dispatches all
 * incoming EventEnvelopes to the Zustand stream reducer.
 * Auto-reconnects with exponential backoff.
 */
export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const { enabled = true } = options;
  const dispatchStreamEvent = useStore((s) => s.dispatchStreamEvent);
  const setSSEStatus = useStore((s) => s.setSSEStatus);
  const sseStatus = useStore((s) => s.ui.globalSSEStatus);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setSSEStatus('connecting');

    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.onopen = () => {
      setSSEStatus('connected');
      retryCountRef.current = 0;
      logger.info('SSE connected');
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        dispatchStreamEvent(event);
      } catch {
        logger.warn('Failed to parse SSE event', { data: e.data });
      }
    };

    es.onerror = () => {
      setSSEStatus('disconnected');
      es.close();
      eventSourceRef.current = null;

      const delay = Math.min(
        1000 * Math.pow(2, retryCountRef.current),
        30000,
      );
      const jitter = Math.random() * 1000;
      retryCountRef.current++;

      logger.warn('SSE disconnected, reconnecting...', {
        delayMs: delay + jitter,
        retry: retryCountRef.current,
      });

      reconnectTimerRef.current = setTimeout(connect, delay + jitter);
    };
  }, [dispatchStreamEvent, setSSEStatus]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    connect();
  }, [connect]);

  useEffect(() => {
    if (!enabled) return;

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [enabled, connect]);

  return { status: sseStatus, reconnect };
}
