import { useState, useEffect, useCallback } from 'react';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import { MotionDiv } from '@/lib/motion';
import SettingsTab from '@/pages/atlas/SettingsTab';

interface Session {
  wallet: string;
  grants: string[];
  roles: string[];
  expiresAt: number;
}

export default function SettingsMode() {
  const { wallet, setMode } = useAtlasStore();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    if (!wallet) {
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('atlas_session_token') || localStorage.getItem('token');
      if (!token) {
        setSession({
          wallet,
          grants: ['read', 'write'],
          roles: ['user'],
          expiresAt: Date.now() + 3600000,
        });
        setLoading(false);
        return;
      }

      const res = await fetch('/api/atlas/session/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-wallet-address': wallet,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.session) {
          setSession({
            wallet: data.session.wallet || wallet,
            grants: data.session.grants || ['read', 'write'],
            roles: data.session.roles || ['user'],
            expiresAt: data.session.expiresAt || Date.now() + 3600000,
          });
        } else {
          setSession({
            wallet,
            grants: ['read', 'write'],
            roles: ['user'],
            expiresAt: Date.now() + 3600000,
          });
        }
      } else {
        setSession({
          wallet,
          grants: ['read', 'write'],
          roles: ['user'],
          expiresAt: Date.now() + 3600000,
        });
      }
    } catch (err) {
      console.error('[SettingsMode] Session fetch failed:', err);
      setSession({
        wallet,
        grants: ['read', 'write'],
        roles: ['user'],
        expiresAt: Date.now() + 3600000,
      });
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleSessionChange = useCallback(() => {
    fetchSession();
  }, [fetchSession]);

  const handleBack = useCallback(() => {
    setMode('hub');
  }, [setMode]);

  if (loading) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 flex flex-col items-center justify-center p-6"
      >
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm mt-4">Loading settings...</p>
      </MotionDiv>
    );
  }

  if (!wallet || !session) {
    return (
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-violet-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-slate-400 text-sm max-w-xs mb-6">
          Connect your wallet to access settings and personalization options.
        </p>
        <Button
          data-testid="button-back-to-hub"
          variant="outline"
          onClick={handleBack}
          className="border-white/20 text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Hub
        </Button>
      </MotionDiv>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-500/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-xs text-slate-400">Preferences & configuration</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <SettingsTab session={session} onSessionChange={handleSessionChange} />
      </div>
    </MotionDiv>
  );
}
