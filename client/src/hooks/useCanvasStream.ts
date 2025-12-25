import { useState, useEffect, useCallback, useRef } from 'react';

export interface FlowEvent {
  type: 'flow-start' | 'step-start' | 'step-complete' | 'flow-error' | 'flow-complete';
  flowId: string;
  flowKey?: string;
  stepId?: string;
  name?: string;
  status?: 'success' | 'error' | 'gated';
  inputSummary?: unknown;
  outputSummary?: unknown;
  durationMs?: number;
  message?: string;
  code?: string;
  startedAt?: string;
  sessionWallet?: string;
  labels?: string[];
}

interface UseCanvasStreamOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  onEvent?: (event: FlowEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useCanvasStream(flowId: string | null, options: UseCanvasStreamOptions = {}) {
  const { autoReconnect = true, reconnectDelay = 3000, onEvent, onConnect, onDisconnect } = options;
  
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!flowId) return;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/atlas/canvas/stream?flow=${encodeURIComponent(flowId)}`);

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
      onConnect?.();
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as FlowEvent;
        setEvents(prev => [...prev, data]);
        onEvent?.(data);
      } catch (e) {
        console.error('[useCanvasStream] Parse error:', e);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      
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
  }, [flowId, autoReconnect, reconnectDelay, onEvent, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    if (flowId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [flowId, connect, disconnect]);

  const flowCompleteEvent = [...events].reverse().find((e: FlowEvent) => e.type === 'flow-complete');
  const flowStatus = flowCompleteEvent?.status;
  const isRunning = events.some((e: FlowEvent) => e.type === 'flow-start') && !flowStatus;

  return {
    events,
    isConnected,
    isRunning,
    flowStatus,
    error,
    connect,
    disconnect,
    clearEvents,
  };
}

export function usePipelineState(events: FlowEvent[]) {
  const steps = new Map<string, {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'complete' | 'error';
    inputSummary?: unknown;
    outputSummary?: unknown;
    durationMs?: number;
    error?: string;
  }>();

  for (const evt of events) {
    if (evt.type === 'step-start' && evt.stepId && evt.name) {
      steps.set(evt.stepId, {
        id: evt.stepId,
        name: evt.name,
        status: 'running',
        inputSummary: evt.inputSummary,
      });
    }

    if (evt.type === 'step-complete' && evt.stepId) {
      const step = steps.get(evt.stepId);
      if (step) {
        step.status = 'complete';
        step.outputSummary = evt.outputSummary;
        step.durationMs = evt.durationMs;
      }
    }

    if (evt.type === 'flow-error' && evt.stepId) {
      const step = steps.get(evt.stepId);
      if (step) {
        step.status = 'error';
        step.error = evt.message;
      }
    }
  }

  const flowComplete = [...events].reverse().find((e: FlowEvent) => e.type === 'flow-complete');
  const flowStart = events.find((e: FlowEvent) => e.type === 'flow-start');

  return {
    steps: Array.from(steps.values()),
    flowStatus: flowComplete?.status || (flowStart ? 'running' : 'pending'),
    totalDuration: flowComplete?.durationMs,
    flowId: flowStart?.flowId,
    flowKey: flowStart?.flowKey,
    wallet: flowStart?.sessionWallet,
  };
}

export async function fetchBufferedEvents(flowId: string): Promise<FlowEvent[]> {
  const response = await fetch(`/api/atlas/canvas/events/${encodeURIComponent(flowId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }
  const data = await response.json();
  return data.events || [];
}

export async function fetchActiveFlows(): Promise<{ active: string[]; buffered: string[] }> {
  const response = await fetch('/api/atlas/canvas/active-flows');
  if (!response.ok) {
    throw new Error(`Failed to fetch active flows: ${response.statusText}`);
  }
  const data = await response.json();
  return { active: data.active || [], buffered: data.buffered || [] };
}
