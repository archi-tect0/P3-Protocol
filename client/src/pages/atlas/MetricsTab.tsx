import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Loader2, 
  BarChart3,
  AlertTriangle,
  Clock,
  Users
} from 'lucide-react';

interface Session {
  wallet: string;
  grants: string[];
  roles: string[];
  expiresAt: number;
}

interface Metrics {
  totalCalls: number;
  totalErrors: number;
  avgDuration: number;
  byEndpoint: Record<string, { calls: number; errors: number; avgDuration: number }>;
  byWallet: Record<string, number>;
  byStatus: Record<string, number>;
}

export default function MetricsTab({ session }: { session: Session }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    fetchMetrics();
  }, [range]);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const response = await fetch(`/api/atlas/metrics?range=${range}`, {
        headers: {
          'X-Wallet-Address': session.wallet,
        },
      });
      const data = await response.json();
      
      if (data.ok) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = session.roles.includes('admin');
  const isMod = session.roles.includes('moderator');

  if (!isAdmin && !isMod) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Access Restricted</h3>
        <p className="text-slate-400 text-sm">
          Metrics are only available to admins and moderators
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Atlas Metrics</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['day', 'week', 'month'] as const).map(r => (
              <button
                key={r}
                data-testid={`range-${r}`}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  range === r
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <Button
            data-testid="button-refresh"
            variant="ghost"
            size="icon"
            onClick={fetchMetrics}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400">Total Calls</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {metrics?.totalCalls.toLocaleString() || 0}
            </p>
          </div>
          
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-slate-400">Errors</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {metrics?.totalErrors.toLocaleString() || 0}
            </p>
          </div>
          
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Avg Duration</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {metrics?.avgDuration ? `${Math.round(metrics.avgDuration)}ms` : '0ms'}
            </p>
          </div>
          
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Unique Wallets</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {Object.keys(metrics?.byWallet || {}).length}
            </p>
          </div>
        </div>

        {metrics?.byEndpoint && Object.keys(metrics.byEndpoint).length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">By Endpoint</h3>
            <div className="space-y-2">
              {Object.entries(metrics.byEndpoint)
                .sort((a, b) => b[1].calls - a[1].calls)
                .slice(0, 10)
                .map(([endpoint, stats]) => (
                  <div 
                    key={endpoint}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-300 font-mono">{endpoint}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                        {stats.calls} calls
                      </Badge>
                      {stats.errors > 0 && (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-300">
                          {stats.errors} errors
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {metrics?.byStatus && Object.keys(metrics.byStatus).length > 0 && (
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">By Status</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.byStatus).map(([status, count]) => (
                <Badge 
                  key={status}
                  className={`text-sm ${
                    status === 'ok' 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : status === 'error'
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .glass-panel {
          background: rgba(30, 30, 30, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
