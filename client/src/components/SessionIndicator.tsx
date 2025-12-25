import { useState, useEffect } from 'react';
import { getSession } from '@/lib/sessionBridgeV2';

export default function SessionIndicator() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      const session = getSession();
      setIsConnected(session !== null && session.connected);
    };

    checkSession();

    const handleConnected = () => {
      setIsConnected(true);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    window.addEventListener('p3:wallet:connected', handleConnected);
    window.addEventListener('p3:wallet:disconnected', handleDisconnected);
    window.addEventListener('p3:connect_approved', handleConnected);
    window.addEventListener('p3:session_revoked', handleDisconnected);

    return () => {
      window.removeEventListener('p3:wallet:connected', handleConnected);
      window.removeEventListener('p3:wallet:disconnected', handleDisconnected);
      window.removeEventListener('p3:connect_approved', handleConnected);
      window.removeEventListener('p3:session_revoked', handleDisconnected);
    };
  }, []);

  if (!isConnected) {
    return null;
  }

  return (
    <div
      data-testid="session-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full"
      style={{
        background: 'rgba(12, 22, 35, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-xs text-emerald-400 font-medium">Session active</span>
    </div>
  );
}
