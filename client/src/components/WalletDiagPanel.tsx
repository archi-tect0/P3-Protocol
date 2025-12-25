import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getDiagSessionId, pushDiag } from '@/lib/sessionBridgeV2';

interface DiagState {
  step: string;
  data?: any;
  localTime: string;
  hasEthereum: boolean;
  ethereumFlags?: {
    isCoinbaseWallet: boolean;
    isMetaMask: boolean;
    isTrust: boolean;
  };
  localStorage: {
    walletAddress?: string;
    authStep?: string;
    authError?: string;
    signMethod?: string;
    signResult?: string;
  };
}

export function WalletDiagPanel() {
  const [states, setStates] = useState<DiagState[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setSessionId(getDiagSessionId());
  }, []);

  const fetchDiag = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/debug/wallet-state/${sessionId}`);
      const data = await res.json();
      if (data && !data.error) {
        setStates(prev => [...prev.slice(-19), data]);
      }
    } catch (e) {
      console.error('Failed to fetch diag', e);
    }
    setLoading(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/debug/wallet-state');
      const data = await res.json();
      if (Array.isArray(data)) {
        setStates(data.filter((d: any) => d.sessionId === sessionId));
      }
    } catch (e) {
      console.error('Failed to fetch all diag', e);
    }
    setLoading(false);
  };

  const sendPing = async () => {
    await pushDiag('manual_ping', { trigger: 'button' });
    await fetchDiag();
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-yellow-500 text-black text-xs font-bold px-3 py-2 rounded-full shadow-lg"
        data-testid="button-open-diag"
      >
        DIAG
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-black/95 text-green-400 font-mono text-[10px] max-h-[50vh] overflow-auto p-2 border-t border-green-500">
      <div className="flex gap-2 mb-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={sendPing} disabled={loading} className="text-xs h-6">
          Ping
        </Button>
        <Button size="sm" variant="outline" onClick={fetchDiag} disabled={loading} className="text-xs h-6">
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={fetchAll} disabled={loading} className="text-xs h-6">
          All
        </Button>
        <Button size="sm" variant="destructive" onClick={() => setExpanded(false)} className="text-xs h-6 ml-auto">
          Close
        </Button>
      </div>
      
      <div className="text-[9px] text-gray-400 mb-1">
        Session: {sessionId}
      </div>

      <div className="space-y-1">
        {states.length === 0 ? (
          <div className="text-gray-500">No diagnostic data yet. Tap Ping or try connecting.</div>
        ) : (
          states.map((s, i) => (
            <div key={i} className="border border-green-800 p-1 rounded">
              <div className="text-yellow-400">{s.step}</div>
              <div className="text-[9px] text-gray-500">{s.localTime}</div>
              {s.data && (
                <pre className="text-[9px] text-green-300 whitespace-pre-wrap">
                  {JSON.stringify(s.data, null, 1)}
                </pre>
              )}
              <div className="text-[9px] text-gray-400">
                eth: {s.hasEthereum ? 'Y' : 'N'} | 
                cb: {s.ethereumFlags?.isCoinbaseWallet ? 'Y' : 'N'} | 
                mm: {s.ethereumFlags?.isMetaMask ? 'Y' : 'N'}
              </div>
              <div className="text-[9px] text-gray-400">
                authStep: {s.localStorage?.authStep || '-'} | 
                signResult: {s.localStorage?.signResult || '-'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
