import { savePointer } from './idb';

export function connectRealtime(address: string): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/realtime`);
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ address }));
    console.log('Realtime connected for', address);
  };
  
  ws.onmessage = async (ev) => {
    try {
      const { type, payload } = JSON.parse(ev.data);
      if (type === 'subscribed') return;
      
      await savePointer(type, payload);
      
      window.dispatchEvent(new CustomEvent('p3-realtime', { 
        detail: { type, payload } 
      }));
    } catch (e) {
      console.error('Realtime message error:', e);
    }
  };
  
  ws.onclose = () => {
    console.log('Realtime disconnected, reconnecting in 3s...');
    setTimeout(() => connectRealtime(address), 3000);
  };
  
  return ws;
}
