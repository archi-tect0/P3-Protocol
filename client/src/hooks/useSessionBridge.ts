import { useEffect, useRef, useCallback } from 'react';
import { useAtlasStore, AtlasMode, AtlasReceipt } from '@/state/useAtlasStore';

interface SessionBridgeMessage {
  type: 'hello' | 'render' | 'receipt' | 'suggestion' | 'trigger' | 'error';
  directive?: {
    mode: AtlasMode;
    payload?: any;
  };
  receipt?: AtlasReceipt;
  suggestions?: Array<{ id: string; label: string; intent: string }>;
  error?: string;
}

export function useSessionBridge(url?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { dissolveInto, pushReceipt, setSuggestions, setRenderPayload } = useAtlasStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/atlas/session`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('[Atlas Session Bridge] Connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const msg: SessionBridgeMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (err) {
          console.error('[Atlas Session Bridge] Parse error:', err);
        }
      };
      
      ws.onclose = () => {
        console.log('[Atlas Session Bridge] Disconnected, reconnecting in 3s...');
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
      
      ws.onerror = (err) => {
        console.error('[Atlas Session Bridge] Error:', err);
      };
    } catch (err) {
      console.error('[Atlas Session Bridge] Connection failed:', err);
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [url]);

  const handleMessage = useCallback((msg: SessionBridgeMessage) => {
    switch (msg.type) {
      case 'hello':
        console.log('[Atlas Session Bridge] Handshake complete');
        break;
        
      case 'render':
        if (msg.directive) {
          dissolveInto(msg.directive.mode);
          if (msg.directive.payload) {
            setRenderPayload(msg.directive.payload);
          }
        }
        if (msg.receipt) {
          pushReceipt(msg.receipt);
        }
        break;
        
      case 'receipt':
        if (msg.receipt) {
          pushReceipt(msg.receipt);
        }
        break;
        
      case 'suggestion':
        if (msg.suggestions) {
          setSuggestions(msg.suggestions.map(s => ({
            ...s,
            category: 'action' as const
          })));
        }
        break;
        
      case 'trigger':
        console.log('[Atlas Session Bridge] Trigger received');
        break;
        
      case 'error':
        console.error('[Atlas Session Bridge] Server error:', msg.error);
        break;
    }
  }, [dissolveInto, pushReceipt, setSuggestions, setRenderPayload]);

  const send = useCallback((type: string, payload?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  const sendIntent = useCallback((intent: string) => {
    send('intent', { intent });
  }, [send]);

  const requestRender = useCallback((mode: AtlasMode, params?: Record<string, any>) => {
    send('render', { mode, params });
  }, [send]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    send,
    sendIntent,
    requestRender,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}
