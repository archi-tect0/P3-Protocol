import { useEffect, useRef, useCallback } from 'react';

interface FlowUpdate {
  type: string;
  idx?: number;
  stepName?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
  status?: 'running' | 'success' | 'failed' | 'rolledback';
  flowId?: string;
  correlationId?: string;
}

interface UseFlowStreamOptions {
  onUpdate?: (update: FlowUpdate) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export function useFlowStream(
  flowId: string | null,
  options: UseFlowStreamOptions = {}
) {
  const {
    onUpdate,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!flowId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/atlas/flows/stream?flow=${encodeURIComponent(flowId)}`);

    es.onopen = () => {
      onConnect?.();
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as FlowUpdate;
        onUpdate?.(data);
      } catch (e) {
        console.error('[useFlowStream] Failed to parse event:', e);
      }
    };

    es.onerror = (event) => {
      onError?.(event);

      if (es.readyState === EventSource.CLOSED) {
        onDisconnect?.();

        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      }
    };

    eventSourceRef.current = es;
  }, [flowId, onUpdate, onConnect, onDisconnect, onError, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (flowId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [flowId, connect, disconnect]);

  return {
    connect,
    disconnect,
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}

export function subscribeFlow(
  flowId: string,
  onUpdate: (update: FlowUpdate) => void
): () => void {
  const es = new EventSource(`/api/atlas/flows/stream?flow=${encodeURIComponent(flowId)}`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as FlowUpdate;
      onUpdate(data);
    } catch (e) {
      console.error('[subscribeFlow] Parse error:', e);
    }
  };

  return () => es.close();
}
