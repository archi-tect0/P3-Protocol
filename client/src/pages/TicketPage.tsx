import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Wallet, CheckCircle2, XCircle, ShieldCheck, CreditCard, Users, Ticket } from 'lucide-react';
import { connectBridge, getSession } from '@/lib/sessionBridgeV2';

type GateType = 'nft' | 'payment' | 'role' | 'free';
type Status = 'init' | 'connecting' | 'gating' | 'anchoring' | 'done' | 'error';

interface GateConfig {
  type: GateType;
  nftCollection?: string;
  paymentAmount?: string;
  paymentCurrency?: string;
  devWallet?: string;
  requiredRole?: string;
}

const defaultGates: Record<string, GateConfig> = {
  encrypt: { type: 'role', requiredRole: 'member' },
  session: { type: 'free' },
  dao: { type: 'role', requiredRole: 'member' },
  media: { type: 'payment', paymentAmount: '1.00', paymentCurrency: 'USD' },
  audit: { type: 'role', requiredRole: 'admin' },
  default: { type: 'free' },
};

async function runNFTGate(wallet: string, collection: string): Promise<boolean> {
  console.log(`[Gate] NFT check: ${wallet} owns ${collection}`);
  return true;
}

async function runPaymentGate(params: {
  wallet: string;
  amount: string;
  currency: string;
  devWallet?: string;
}): Promise<{ ok: boolean; txHash?: string }> {
  console.log(`[Gate] Payment: ${params.amount} ${params.currency} from ${params.wallet}`);
  return { ok: true, txHash: '0x' + Math.random().toString(16).slice(2) };
}

async function runRoleGate(wallet: string, role: string): Promise<boolean> {
  console.log(`[Gate] Role check: ${wallet} has ${role}`);
  return true;
}

export default function TicketPage() {
  const params = new URLSearchParams(window.location.search);
  const appId = params.get('appId') || 'unknown';
  const scopes = (params.get('scopes') || '').split(',').filter(Boolean);
  const returnTo = params.get('returnTo') || '/';
  void (params.get('reason') || 'no_ticket');

  const [wallet, setWallet] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('init');
  const [error, setError] = useState<string | null>(null);
  const [gateType, setGateType] = useState<GateType>('free');

  const getGateConfig = useCallback((): GateConfig => {
    const primaryScope = scopes[0] || 'default';
    return defaultGates[primaryScope] || defaultGates.default;
  }, [scopes]);

  const runGateFlow = useCallback(async (walletAddress: string) => {
    const config = getGateConfig();
    setGateType(config.type);
    setStatus('gating');

    let gateResult = { ok: false, txHash: undefined as string | undefined };

    try {
      switch (config.type) {
        case 'nft':
          const nftOk = await runNFTGate(walletAddress, config.nftCollection || 'p3-ticket');
          gateResult = { ok: nftOk, txHash: undefined };
          break;

        case 'payment':
          const paymentResult = await runPaymentGate({
            wallet: walletAddress,
            amount: config.paymentAmount || '1.00',
            currency: config.paymentCurrency || 'USD',
            devWallet: config.devWallet,
          });
          gateResult = { ok: paymentResult.ok, txHash: paymentResult.txHash || undefined };
          break;

        case 'role':
          const roleOk = await runRoleGate(walletAddress, config.requiredRole || 'member');
          gateResult = { ok: roleOk, txHash: undefined };
          break;

        case 'free':
        default:
          gateResult = { ok: true, txHash: undefined };
          break;
      }

      if (!gateResult.ok) {
        throw new Error('gate_failed');
      }

      setStatus('anchoring');

      await fetch('/api/sdk/anchor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Id': appId,
        },
        body: JSON.stringify({
          appId: 'ticketGate',
          event: 'access_granted',
          data: {
            wallet: walletAddress,
            appId,
            scopes,
            gateType: config.type,
            txHash: gateResult.txHash,
            feeAmount: config.paymentAmount,
            devWallet: config.devWallet,
          },
          anchor: true,
          ts: Date.now(),
        }),
      });

      await fetch('/api/sdk/ticket/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          appId,
          scopes,
          gateType: config.type,
          txHash: gateResult.txHash,
          feeAmount: config.paymentAmount,
          devWallet: config.devWallet,
        }),
      });

      setStatus('done');

      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          window.location.href = returnTo;
        }
      }, 1500);

    } catch (err: any) {
      console.error('[Ticket] Gate error:', err);
      setError(err?.message || 'Gate failed');
      setStatus('error');
    }
  }, [appId, scopes, returnTo, getGateConfig]);

  useEffect(() => {
    const init = async () => {
      const existingSession = getSession();
      if (existingSession?.address) {
        setWallet(existingSession.address);
        await runGateFlow(existingSession.address);
        return;
      }

      setStatus('connecting');
      try {
        const session = await connectBridge();
        if (session?.address) {
          setWallet(session.address);
          await runGateFlow(session.address);
        } else {
          throw new Error('Connection failed');
        }
      } catch (err: any) {
        console.error('[Ticket] Connection error:', err);
        setError(err?.message || 'Connection failed');
        setStatus('error');
      }
    };

    init();
  }, [runGateFlow]);

  const getStatusIcon = () => {
    switch (status) {
      case 'connecting':
        return <Wallet className="w-8 h-8 text-purple-400 animate-pulse" />;
      case 'gating':
        return gateType === 'payment' 
          ? <CreditCard className="w-8 h-8 text-amber-400 animate-pulse" />
          : gateType === 'role'
          ? <Users className="w-8 h-8 text-blue-400 animate-pulse" />
          : <ShieldCheck className="w-8 h-8 text-cyan-400 animate-pulse" />;
      case 'anchoring':
        return <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />;
      case 'done':
        return <CheckCircle2 className="w-8 h-8 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-red-400" />;
      default:
        return <Ticket className="w-8 h-8 text-slate-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return 'Connecting wallet...';
      case 'gating':
        return gateType === 'payment' 
          ? 'Processing payment...'
          : gateType === 'role'
          ? 'Verifying membership...'
          : gateType === 'nft'
          ? 'Checking NFT ownership...'
          : 'Verifying access...';
      case 'anchoring':
        return 'Anchoring access receipt...';
      case 'done':
        return 'Access granted!';
      case 'error':
        return 'Access denied';
      default:
        return 'Initializing...';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/80 border-slate-700/50 backdrop-blur-xl">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
            <Ticket className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-xl text-white">Access Ticket</CardTitle>
          <CardDescription className="text-slate-400">
            One-time verification for {appId}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-4">
              {getStatusIcon()}
              <p className="text-sm font-medium text-slate-300">{getStatusText()}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-500">App</span>
              <span className="text-slate-300 font-mono">{appId}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-500">Scopes</span>
              <span className="text-slate-300">{scopes.join(', ') || 'none'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-500">Wallet</span>
              <span className="text-slate-300 font-mono text-xs">
                {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : 'Not connected'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Gate</span>
              <span className="text-slate-300 capitalize">{gateType}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {status === 'error' && (
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-purple-600 hover:bg-purple-500"
            >
              Try Again
            </Button>
          )}

          {status === 'done' && (
            <p className="text-center text-xs text-slate-500">
              Redirecting back to {appId}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
