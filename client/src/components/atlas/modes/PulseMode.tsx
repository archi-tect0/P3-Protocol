import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { 
  Activity, Users, Globe, Monitor,
  MessageSquare, Database, TrendingUp, TrendingDown, Clock,
  RefreshCw, Loader2, MapPin, BarChart3,
  Zap, Timer, Link2, Code, Layers, Battery,
  User, Server, Shield, ArrowUpDown,
  Gamepad2, BookOpen, Video, Package, GitCommit, GitBranch, Network, Plug,
  ArrowRight, Search, Compass, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAtlasStore } from '@/state/useAtlasStore';

interface PulseMetrics {
  liveUsers: number;
  uniqueVisitors24h: number;
  totalPageViews: number;
  topPages: { route: string; views: number }[];
  topReferrers: { referrer: string; views: number }[];
  geoData: { country: string; count: number }[];
  browsers: { browser: string; views: number }[];
  devices: { device: string; views: number }[];
  messagesToday: number;
  catalogItems: number;
  trafficByHour: { hour: number; count: number }[];
  sessionDepth: { avgPagesPerSession: number; totalSessions: number; deepSessions: number };
  timeOnSurface: { avgSeconds: number; medianSeconds: number; maxSeconds: number };
  navigationFlow: { from: string; to: string; count: number }[];
  searchIntentDensity: { avgSearchesPerUser: number; totalSearches: number; uniqueSearchers: number };
}

interface EfficiencyMetrics {
  payload: {
    atlasAvgBytes: number;
    restAvgBytes: number;
    savingsPercent: number;
    explainer: string;
    isLive?: boolean;
    details?: {
      binaryEncoding: string;
      compression: string;
      deltaSync: string;
      requestsTracked: number;
    };
  };
  latency: {
    atlasP50Ms: number;
    atlasP95Ms: number;
    restP50Ms: number;
    restP95Ms: number;
    improvementPercent: number;
    explainer: string;
    isLive?: boolean;
    details?: {
      connectionPool: string;
      edgeCaching: string;
      prefetching: string;
      requestsTracked: number;
    };
  };
  session: {
    atlasSessionReuse: number;
    restStatelessOverhead: number;
    savedConnections: number;
    explainer: string;
    isLive?: boolean;
    details?: {
      authentication: string;
      sessionDuration: string;
      encryption: string;
      totalSessions: number;
    };
  };
  developer: {
    unifiedEndpoints: number;
    fragmentedEndpoints: number;
    reductionPercent: number;
    explainer: string;
    details?: {
      canvasModes: number;
      deepLinkApps: number;
      voiceCommands: boolean;
      blockchainAnchoring: boolean;
    };
  };
  catalog: {
    autoSynced: number;
    manualBaseline: number;
    automationPercent: number;
    explainer: string;
    details?: {
      sources: string[];
      categories: string[];
      syncFrequency: string;
    };
  };
  resource: {
    atlasBandwidthMb: number;
    restBandwidthMb: number;
    savingsPercent: number;
    cpuReductionPercent: number;
    explainer: string;
    isLive?: boolean;
    details?: {
      serverPool: string;
      caching: string;
      serialization: string;
      totalRequests: number;
    };
  };
}

interface PulseResponse {
  success: boolean;
  timestamp: string;
  metrics: PulseMetrics;
  efficiency: EfficiencyMetrics;
}

interface EndpointMetrics {
  callsPerMinute: number;
  latencyP50: number;
  latencyP95: number;
  payloadEfficiency: number;
  uptime: number;
  totalCalls: number;
  errorRate: number;
  lastCallAt: string | null;
}

interface PersonalEndpoint {
  id: string;
  name: string;
  url: string;
  status: string;
  metrics: EndpointMetrics | null;
}

interface SurfaceGrowthResponse {
  success: boolean;
  timestamp: string;
  totals: {
    games: number;
    ebooks: number;
    videos: number;
    products: number;
    total: number;
  };
  byType: {
    games: { total: number; deltas: { today: number; thisWeek: number; thisMonth: number } };
    ebooks: { total: number; deltas: { today: number; thisWeek: number; thisMonth: number } };
    videos: { total: number; deltas: { today: number; thisWeek: number; thisMonth: number } };
    products: { total: number; deltas: { today: number; thisWeek: number; thisMonth: number } };
  };
  aggregateDeltas: { today: number; thisWeek: number; thisMonth: number };
  narrative: string;
}

interface CodebaseGrowthResponse {
  success: boolean;
  timestamp: string;
  commits: { today: number; thisWeek: number; thisMonth: number; total: number };
  linesOfCode: { added: number; removed: number; net: number; total: number };
  files: { created: number; modified: number; deleted: number };
  buildSize?: { clientMB: number; totalMB: number };
  contributors: number;
  branches: number;
  healthScore: number;
  narrative: string;
}

interface MeshConnectionsResponse {
  success: boolean;
  timestamp: string;
  connections: {
    activeApis: number;
    registeredEndpoints: number;
    integratedApps: number;
    webhooks: number;
  };
  recentActivity: Array<{
    type: string;
    endpoint: string;
    timestamp: string;
  }>;
  narrative: string;
}

type DrilldownType = 
  | 'geo' | 'pages' | 'devices' | 'traffic' 
  | 'eff-payload' | 'eff-latency' | 'eff-session' 
  | 'eff-developer' | 'eff-catalog' | 'eff-resource' 
  | 'surface-growth' | 'codebase-growth' | 'mesh-connections'
  | 'referrers' | 'session-depth' | 'time-on-surface' | 'navigation-flow' | 'search-intent'
  | `my-endpoint-${string}`
  | null;

function ComparisonBar({ 
  label, 
  atlasValue, 
  baselineValue, 
  unit = '',
  atlasColor = 'from-cyan-500 to-blue-500',
  baselineColor = 'from-gray-500 to-gray-600',
  lowerIsBetter = true
}: {
  label: string;
  atlasValue: number;
  baselineValue: number;
  unit?: string;
  atlasColor?: string;
  baselineColor?: string;
  lowerIsBetter?: boolean;
}) {
  const maxVal = Math.max(atlasValue, baselineValue, 1);
  const atlasWidth = maxVal > 0 ? (atlasValue / maxVal) * 100 : 0;
  const baselineWidth = maxVal > 0 ? (baselineValue / maxVal) * 100 : 0;
  const better = lowerIsBetter ? atlasValue < baselineValue : atlasValue > baselineValue;
  const bothZero = atlasValue === 0 && baselineValue === 0;

  if (bothZero) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-white/50">{label}</div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
          <span className="text-xs text-white/40">No data yet - metrics will appear as traffic increases</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-white/50">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyan-400 w-16">Atlas</span>
          <MotionDiv
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(atlasWidth, 5)}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className={`h-6 bg-gradient-to-r ${atlasColor} rounded-md flex items-center justify-end pr-2 min-w-[40px]`}
          >
            <span className="text-xs text-white font-semibold">{atlasValue}{unit}</span>
          </MotionDiv>
          {better && <span className="text-xs text-emerald-400">Better</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-16">REST</span>
          <MotionDiv
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(baselineWidth, 5)}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className={`h-6 bg-gradient-to-r ${baselineColor} rounded-md flex items-center justify-end pr-2 min-w-[40px]`}
          >
            <span className="text-xs text-white/80">{baselineValue}{unit}</span>
          </MotionDiv>
        </div>
      </div>
    </div>
  );
}

export default function PulseMode() {
  const [drilldown, setDrilldown] = useState<DrilldownType>(null);
  const [myEndpoints, setMyEndpoints] = useState<PersonalEndpoint[]>([]);
  const [loadingMyEndpoints, setLoadingMyEndpoints] = useState(false);

  const { wallet, pulseView, setPulseView } = useAtlasStore();
  
  const [showMyPulse, setShowMyPulse] = useState(pulseView === 'personal');

  const { data, isLoading, error, refetch, isFetching } = useQuery<PulseResponse>({
    queryKey: ['/api/atlas/pulse'],
    refetchInterval: 30000,
  });

  const { data: _rokuStats } = useQuery<{ connectedWallets: number; activePaired: number; activeUnpaired: number }>({
    queryKey: ['/api/atlas/roku/stats'],
    refetchInterval: 30000,
  });

  const { data: surfaceGrowth } = useQuery<SurfaceGrowthResponse>({
    queryKey: ['/api/atlas/pulse/growth'],
    refetchInterval: 60000,
  });

  const { data: codebaseGrowth } = useQuery<CodebaseGrowthResponse>({
    queryKey: ['/api/atlas/pulse/codebase'],
    refetchInterval: 120000,
  });

  const { data: meshConnections } = useQuery<MeshConnectionsResponse>({
    queryKey: ['/api/atlas/pulse/mesh'],
    refetchInterval: 60000,
  });

  const fetchMyEndpoints = useCallback(async () => {
    if (!wallet) return;
    setLoadingMyEndpoints(true);
    
    const res = await fetch(`/api/atlas/endpoints?wallet=${wallet}`);
    if (!res.ok) {
      setLoadingMyEndpoints(false);
      throw new Error(`Failed to fetch endpoints: ${res.status}`);
    }
    
    const data = await res.json();
    if (data.ok && data.endpoints?.length > 0) {
      const endpointsWithMetrics = await Promise.all(
        data.endpoints.filter((e: any) => e.status === 'validated').map(async (endpoint: any) => {
          const metricsRes = await fetch(`/api/atlas/endpoints/${endpoint.id}/metrics?wallet=${wallet}`);
          if (!metricsRes.ok) {
            throw new Error(`Failed to fetch metrics for ${endpoint.id}: ${metricsRes.status}`);
          }
          const metricsData = await metricsRes.json();
          return { ...endpoint, metrics: metricsData.ok ? metricsData.metrics : null };
        })
      );
      setMyEndpoints(endpointsWithMetrics);
    } else {
      setMyEndpoints([]);
    }
    setLoadingMyEndpoints(false);
  }, [wallet]);

  useEffect(() => {
    if (wallet && showMyPulse) {
      fetchMyEndpoints();
    }
  }, [wallet, showMyPulse, fetchMyEndpoints]);

  useEffect(() => {
    setShowMyPulse(pulseView === 'personal');
  }, [pulseView]);

  useEffect(() => {
    return () => {
      setPulseView('global');
    };
  }, [setPulseView]);

  const metrics = data?.metrics;
  const efficiency = data?.efficiency;

  if (isLoading) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full gap-4"
        data-testid="pulse-loading"
      >
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        <p className="text-white/60">Loading Atlas Pulse...</p>
      </MotionDiv>
    );
  }

  if (error || !metrics) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full gap-4"
        data-testid="pulse-error"
      >
        <Activity className="w-12 h-12 text-red-400" />
        <p className="text-white/60">Failed to load pulse data</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </MotionDiv>
    );
  }

  if (drilldown === 'geo') {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-geo"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            Geographic Distribution
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">Visitor distribution by country (hashed IPs, privacy-preserved)</p>
        <div className="grid gap-2 mt-4">
          {metrics.geoData.length > 0 ? metrics.geoData.map((g, i) => (
            <MotionDiv
              key={g.country}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span className="text-white">{g.country || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 bg-cyan-500/30 rounded-full" style={{ width: `${Math.min(100, (g.count / metrics.geoData[0].count) * 100)}px` }} />
                <span className="text-white/60 text-sm w-12 text-right">{g.count}</span>
              </div>
            </MotionDiv>
          )) : (
            <p className="text-white/40 text-center py-8">No geographic data yet</p>
          )}
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'pages') {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-pages"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-400" />
            Top Pages & Endpoints
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">Most visited routes in the substrate</p>
        <div className="grid gap-2 mt-4">
          {metrics.topPages.length > 0 ? metrics.topPages.map((p, i) => (
            <MotionDiv
              key={p.route}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <span className="text-white font-mono text-sm truncate max-w-[200px]">{p.route}</span>
              <span className="text-violet-400 font-semibold">{p.views}</span>
            </MotionDiv>
          )) : (
            <p className="text-white/40 text-center py-8">No page data yet</p>
          )}
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'devices') {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-devices"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Monitor className="w-5 h-5 text-emerald-400" />
            Devices & Browsers
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white/60">Devices</h3>
            {metrics.devices.map((d, i) => (
              <MotionDiv
                key={d.device}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
              >
                <span className="text-white text-sm">{d.device}</span>
                <span className="text-emerald-400 text-sm">{d.views}</span>
              </MotionDiv>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white/60">Browsers</h3>
            {metrics.browsers.map((b, i) => (
              <MotionDiv
                key={b.browser}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
              >
                <span className="text-white text-sm">{b.browser}</span>
                <span className="text-emerald-400 text-sm">{b.views}</span>
              </MotionDiv>
            ))}
          </div>
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'traffic') {
    const maxTraffic = Math.max(...metrics.trafficByHour.map(t => t.count), 1);
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-traffic"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Traffic by Hour (24h)
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">Hourly activity distribution</p>
        <div className="flex items-end gap-1 h-40 mt-4 px-2">
          {metrics.trafficByHour.map((t, i) => (
            <MotionDiv
              key={t.hour}
              initial={{ height: 0 }}
              animate={{ height: `${(t.count / maxTraffic) * 100}%` }}
              transition={{ delay: i * 0.02, duration: 0.5 }}
              className="flex-1 bg-gradient-to-t from-amber-500/80 to-amber-400/40 rounded-t-sm min-h-[4px] relative group cursor-pointer"
              title={`${t.hour}:00 - ${t.count} visits`}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs text-white bg-black/80 px-1 rounded whitespace-nowrap transition-opacity">
                {t.count}
              </div>
            </MotionDiv>
          ))}
        </div>
        <div className="flex justify-between text-xs text-white/40 px-2">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>23:00</span>
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'referrers') {
    const maxReferrer = metrics.topReferrers[0]?.views || 1;
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-referrers"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-pink-400" />
            Top Referrers
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">Where visitors come from - top 10 referral sources</p>
        <div className="grid gap-2 mt-4">
          {metrics.topReferrers.length > 0 ? metrics.topReferrers.slice(0, 10).map((r, i) => (
            <MotionDiv
              key={r.referrer}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-6 h-6 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-pink-400 font-semibold">{i + 1}</span>
                </div>
                <span className="text-white text-sm truncate max-w-[180px]" title={r.referrer}>
                  {r.referrer === 'Direct' ? 'Direct / None' : r.referrer.replace(/https?:\/\//, '').replace(/\/$/, '')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 bg-pink-500/30 rounded-full" style={{ width: `${Math.min(80, (r.views / maxReferrer) * 80)}px` }} />
                <span className="text-pink-400 font-semibold text-sm w-12 text-right">{r.views}</span>
              </div>
            </MotionDiv>
          )) : (
            <p className="text-white/40 text-center py-8">No referrer data yet</p>
          )}
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'session-depth') {
    const { sessionDepth } = metrics;
    const deepPercent = sessionDepth.totalSessions > 0 
      ? Math.round((sessionDepth.deepSessions / sessionDepth.totalSessions) * 100)
      : 0;
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-session-depth"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Session Depth
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">How engaged users are - average pages explored per session</p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-center"
          >
            <div className="text-4xl font-bold text-indigo-400">{sessionDepth.avgPagesPerSession}</div>
            <div className="text-sm text-white/60 mt-2">Avg Pages/Session</div>
          </MotionDiv>
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 text-center"
          >
            <div className="text-4xl font-bold text-purple-400">{sessionDepth.totalSessions}</div>
            <div className="text-sm text-white/60 mt-2">Total Sessions</div>
          </MotionDiv>
        </div>
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/60">Deep Sessions (5+ pages)</div>
              <div className="text-2xl font-bold text-green-400">{sessionDepth.deepSessions}</div>
            </div>
            <div className="text-3xl font-bold text-green-400/80">{deepPercent}%</div>
          </div>
          <div className="text-xs text-white/40 mt-2">Users exploring beyond the landing page</div>
        </MotionDiv>
      </MotionDiv>
    );
  }

  if (drilldown === 'time-on-surface') {
    const { timeOnSurface } = metrics;
    const formatTime = (seconds: number) => {
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-time-on-surface"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-teal-400" />
            Time on Surface
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">How long users stay engaged with the substrate</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 text-center"
          >
            <div className="text-2xl font-bold text-teal-400">{formatTime(timeOnSurface.avgSeconds)}</div>
            <div className="text-xs text-white/60 mt-1">Average</div>
          </MotionDiv>
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center"
          >
            <div className="text-2xl font-bold text-white/80">{formatTime(timeOnSurface.medianSeconds)}</div>
            <div className="text-xs text-white/60 mt-1">Median</div>
          </MotionDiv>
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center"
          >
            <div className="text-2xl font-bold text-amber-400">{formatTime(timeOnSurface.maxSeconds)}</div>
            <div className="text-xs text-white/60 mt-1">Longest</div>
          </MotionDiv>
        </div>
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10"
        >
          <p className="text-sm text-white/60">
            {timeOnSurface.avgSeconds > 60 
              ? "Strong engagement - users are exploring deeply."
              : timeOnSurface.avgSeconds > 30 
                ? "Healthy engagement - users are interacting with content."
                : "Quick visits - consider optimizing landing experience."}
          </p>
        </MotionDiv>
      </MotionDiv>
    );
  }

  if (drilldown === 'navigation-flow') {
    const { navigationFlow } = metrics;
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-navigation-flow"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-orange-400" />
            Navigation Flow
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">Most common page transitions - where users go next</p>
        <div className="grid gap-2 mt-4">
          {navigationFlow.length > 0 ? navigationFlow.map((flow, i) => (
            <MotionDiv
              key={`${flow.from}-${flow.to}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-white text-sm truncate max-w-[100px] font-mono" title={flow.from}>
                  {flow.from.replace('/atlas', '/') || '/'}
                </span>
                <ArrowRight className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span className="text-white text-sm truncate max-w-[100px] font-mono" title={flow.to}>
                  {flow.to.replace('/atlas', '/') || '/'}
                </span>
              </div>
              <span className="text-orange-400 font-semibold text-sm flex-shrink-0">{flow.count}</span>
            </MotionDiv>
          )) : (
            <p className="text-white/40 text-center py-8">No navigation flow data yet - needs multiple page visits per session</p>
          )}
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'search-intent') {
    const { searchIntentDensity } = metrics;
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -100 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
        data-testid="pulse-drilldown-search-intent"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Search Intent Density
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/50">How actively users search and explore topics</p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-center"
          >
            <div className="text-4xl font-bold text-blue-400">{searchIntentDensity.avgSearchesPerUser}</div>
            <div className="text-sm text-white/60 mt-2">Avg Searches/User</div>
          </MotionDiv>
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 text-center"
          >
            <div className="text-4xl font-bold text-cyan-400">{searchIntentDensity.totalSearches}</div>
            <div className="text-sm text-white/60 mt-2">Total Searches</div>
          </MotionDiv>
        </div>
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-2xl bg-white/5 border border-white/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/60">Unique Searchers</div>
              <div className="text-2xl font-bold text-white">{searchIntentDensity.uniqueSearchers}</div>
            </div>
            <Search className="w-8 h-8 text-blue-400/50" />
          </div>
          <div className="text-xs text-white/40 mt-2">
            {searchIntentDensity.avgSearchesPerUser > 2 
              ? "High intent density - users are actively exploring"
              : searchIntentDensity.avgSearchesPerUser > 1 
                ? "Moderate search activity"
                : "Low search usage - consider promoting search features"}
          </div>
        </MotionDiv>
      </MotionDiv>
    );
  }

  if (drilldown === 'eff-payload' && efficiency) {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-eff-payload"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Payload Size Efficiency
            {efficiency.payload.isLive ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                LIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/50 rounded-full border border-white/20">
                BASELINE
              </span>
            )}
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {efficiency.payload.isLive 
            ? `${efficiency.payload.explainer} These are real-time measurements from your Atlas API traffic.`
            : efficiency.payload.explainer}
        </p>
        <div className="space-y-6 mt-4">
          <ComparisonBar
            label="Average Payload Size"
            atlasValue={efficiency.payload.atlasAvgBytes}
            baselineValue={efficiency.payload.restAvgBytes}
            unit=" bytes"
            atlasColor="from-yellow-500 to-amber-500"
          />
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20"
          >
            <div className="text-5xl font-bold text-yellow-400">{efficiency.payload.savingsPercent}%</div>
            <div className="text-white/60 text-sm">smaller payloads<br/>with Atlas</div>
          </MotionDiv>
          
          {efficiency.payload.details && (
            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-white/80">How Atlas Optimizes Payloads</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-sm text-white/70">{efficiency.payload.details.binaryEncoding}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-sm text-white/70">Compression: {efficiency.payload.details.compression}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-sm text-white/70">{efficiency.payload.details.deltaSync}</span>
                </div>
              </div>
              <div className="text-xs text-white/40 text-center mt-2">
                {efficiency.payload.details.requestsTracked} requests tracked
              </div>
            </MotionDiv>
          )}
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'eff-latency' && efficiency) {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-eff-latency"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-green-400" />
            Latency Efficiency
            {efficiency.latency.isLive ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                LIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/50 rounded-full border border-white/20">
                BASELINE
              </span>
            )}
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {efficiency.latency.isLive 
            ? `${efficiency.latency.explainer} These are real-time measurements from your Atlas API traffic.`
            : efficiency.latency.explainer}
        </p>
        <div className="space-y-6 mt-4">
          <ComparisonBar
            label="P50 Response Time"
            atlasValue={efficiency.latency.atlasP50Ms}
            baselineValue={efficiency.latency.restP50Ms}
            unit="ms"
            atlasColor="from-green-500 to-emerald-500"
          />
          <ComparisonBar
            label="P95 Response Time"
            atlasValue={efficiency.latency.atlasP95Ms}
            baselineValue={efficiency.latency.restP95Ms}
            unit="ms"
            atlasColor="from-green-500 to-emerald-500"
          />
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
          >
            <div className="text-5xl font-bold text-green-400">{efficiency.latency.improvementPercent}%</div>
            <div className="text-white/60 text-sm">faster responses<br/>with Atlas</div>
          </MotionDiv>
          
          {efficiency.latency.details && (
            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-white/80">How Atlas Reduces Latency</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-white/70">{efficiency.latency.details.connectionPool}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-white/70">{efficiency.latency.details.edgeCaching}</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm text-white/70">{efficiency.latency.details.prefetching}</span>
                </div>
              </div>
              <div className="text-xs text-white/40 text-center mt-2">
                {efficiency.latency.details.requestsTracked} requests tracked
              </div>
            </MotionDiv>
          )}
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'eff-session' && efficiency) {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-eff-session"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-400" />
            Session Efficiency
            {efficiency.session.isLive ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                LIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-white/10 text-white/50 rounded-full border border-white/20">
                BASELINE
              </span>
            )}
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {efficiency.session.isLive 
            ? `${efficiency.session.explainer} These are real-time measurements from your Atlas API traffic.`
            : efficiency.session.explainer}
        </p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 text-center"
          >
            <div className="text-4xl font-bold text-blue-400">{efficiency.session.atlasSessionReuse}%</div>
            <div className="text-sm text-white/60 mt-2">Session Reuse</div>
            <div className="text-xs text-white/40 mt-1">Atlas keeps connections alive</div>
          </MotionDiv>
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center"
          >
            <div className="text-4xl font-bold text-gray-400">{efficiency.session.restStatelessOverhead}%</div>
            <div className="text-sm text-white/60 mt-2">Stateless Overhead</div>
            <div className="text-xs text-white/40 mt-1">REST creates new connections</div>
          </MotionDiv>
        </div>
        <MotionDiv
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
        >
          <span className="text-2xl font-bold text-blue-400">{efficiency.session.savedConnections.toLocaleString()}</span>
          <span className="text-white/60 text-sm ml-2">connections saved</span>
        </MotionDiv>
      </MotionDiv>
    );
  }

  if (drilldown === 'eff-developer' && efficiency) {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-eff-developer"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-400" />
            Developer Efficiency
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {efficiency.developer.explainer}
        </p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <MotionDiv
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <Layers className="w-8 h-8 text-purple-400" />
              <span className="text-lg font-semibold text-white">Atlas Unified</span>
            </div>
            <div className="text-4xl font-bold text-purple-400">{efficiency.developer.unifiedEndpoints}</div>
            <div className="text-sm text-white/50 mt-1">endpoints in one manifest</div>
          </MotionDiv>
          <MotionDiv
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-white/5 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 flex items-center justify-center text-gray-400">
                <span className="text-2xl">~</span>
              </div>
              <span className="text-lg font-semibold text-white/60">Traditional REST</span>
            </div>
            <div className="text-4xl font-bold text-gray-400">{efficiency.developer.fragmentedEndpoints}</div>
            <div className="text-sm text-white/40 mt-1">separate endpoints needed</div>
          </MotionDiv>
        </div>
        <MotionDiv
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20"
        >
          <div className="text-5xl font-bold text-purple-400">{efficiency.developer.reductionPercent}%</div>
          <div className="text-white/60 text-sm">less complexity<br/>for developers</div>
        </MotionDiv>
      </MotionDiv>
    );
  }

  if (drilldown === 'eff-catalog' && efficiency) {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-eff-catalog"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-400" />
            Catalog Efficiency
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {efficiency.catalog.explainer}
        </p>
        <div className="space-y-4 mt-4">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/50">Auto-synced Items</div>
                <div className="text-3xl font-bold text-orange-400">{efficiency.catalog.autoSynced.toLocaleString()}</div>
              </div>
              <MotionDiv
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center"
              >
                <Database className="w-8 h-8 text-orange-400" />
              </MotionDiv>
            </div>
          </MotionDiv>
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-white/60">Manual ingestion would yield</span>
            <span className="text-gray-400 font-semibold">{efficiency.catalog.manualBaseline.toLocaleString()} items</span>
          </div>
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20"
          >
            <div className="text-5xl font-bold text-orange-400">{efficiency.catalog.automationPercent}%</div>
            <div className="text-white/60 text-sm mt-2">automated with Atlas sync</div>
          </MotionDiv>
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'eff-resource' && efficiency) {
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-eff-resource"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Battery className="w-5 h-5 text-teal-400" />
            Resource Efficiency
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {efficiency.resource.explainer}
        </p>
        <div className="space-y-6 mt-4">
          <ComparisonBar
            label="Bandwidth Usage"
            atlasValue={efficiency.resource.atlasBandwidthMb}
            baselineValue={efficiency.resource.restBandwidthMb}
            unit=" MB"
            atlasColor="from-teal-500 to-cyan-500"
          />
          <div className="grid md:grid-cols-2 gap-4">
            <MotionDiv
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 text-center"
            >
              <div className="text-4xl font-bold text-teal-400">{efficiency.resource.savingsPercent}%</div>
              <div className="text-sm text-white/60 mt-2">bandwidth saved</div>
            </MotionDiv>
            <MotionDiv
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 text-center"
            >
              <div className="text-4xl font-bold text-teal-400">{efficiency.resource.cpuReductionPercent}%</div>
              <div className="text-sm text-white/60 mt-2">CPU reduction</div>
            </MotionDiv>
          </div>
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'surface-growth' && surfaceGrowth?.success) {
    const { byType, aggregateDeltas, narrative } = surfaceGrowth;
    const growthItems = [
      { key: 'games', label: 'Games', icon: Gamepad2, data: byType.games, color: 'from-indigo-500 to-purple-500' },
      { key: 'ebooks', label: 'Ebooks', icon: BookOpen, data: byType.ebooks, color: 'from-emerald-500 to-teal-500' },
      { key: 'videos', label: 'Videos', icon: Video, data: byType.videos, color: 'from-red-500 to-pink-500' },
      { key: 'products', label: 'Products', icon: Package, data: byType.products, color: 'from-amber-500 to-orange-500' },
    ];
    
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-surface-growth"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Surface Growth
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {narrative}
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          {growthItems.map((item, i) => {
            const Icon = item.icon;
            const delta = item.data.deltas.today;
            const isPositive = delta > 0;
            return (
              <MotionDiv
                key={item.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-2xl bg-gradient-to-br ${item.color.replace('from-', 'from-').replace('to-', 'to-')}/10 border border-white/10`}
                data-testid={`growth-item-${item.key}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-6 h-6 text-white/80" />
                  <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-white/40'}`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : delta < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                    <span>{isPositive ? '+' : ''}{delta}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">{item.data.total.toLocaleString()}</div>
                <div className="text-xs text-white/50">{item.label}</div>
                <div className="mt-2 flex gap-2 text-xs text-white/40">
                  <span>Week: {item.data.deltas.thisWeek > 0 ? '+' : ''}{item.data.deltas.thisWeek}</span>
                  <span>Month: {item.data.deltas.thisMonth > 0 ? '+' : ''}{item.data.deltas.thisMonth}</span>
                </div>
              </MotionDiv>
            );
          })}
        </div>

        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 text-center"
        >
          <div className="text-3xl font-bold text-cyan-400">{surfaceGrowth.totals.total.toLocaleString()}</div>
          <div className="text-sm text-white/50">Total Catalog Items</div>
          <div className="flex justify-center gap-4 mt-2 text-xs text-white/40">
            <span>Today: {aggregateDeltas.today > 0 ? '+' : ''}{aggregateDeltas.today}</span>
            <span>Week: {aggregateDeltas.thisWeek > 0 ? '+' : ''}{aggregateDeltas.thisWeek}</span>
            <span>Month: {aggregateDeltas.thisMonth > 0 ? '+' : ''}{aggregateDeltas.thisMonth}</span>
          </div>
        </MotionDiv>
      </MotionDiv>
    );
  }

  if (drilldown === 'codebase-growth' && codebaseGrowth?.success) {
    const { commits, linesOfCode, files, buildSize, contributors, branches, healthScore, narrative } = codebaseGrowth;
    
    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-codebase-growth"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-violet-400" />
            Codebase Growth
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {narrative}
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20"
            data-testid="codebase-commits"
          >
            <GitCommit className="w-6 h-6 text-violet-400 mb-2" />
            <div className="text-2xl font-bold text-white">{commits.total}</div>
            <div className="text-xs text-white/50">Total Commits</div>
            <div className="text-xs text-violet-400/80 mt-1">+{commits.today} today</div>
          </MotionDiv>
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
            data-testid="codebase-lines"
          >
            <Code className="w-6 h-6 text-green-400 mb-2" />
            <div className="text-2xl font-bold text-white">{linesOfCode.net > 0 ? '+' : ''}{linesOfCode.net.toLocaleString()}</div>
            <div className="text-xs text-white/50">Net Lines</div>
            <div className="text-xs text-green-400/80 mt-1">+{linesOfCode.added.toLocaleString()} / -{linesOfCode.removed.toLocaleString()}</div>
          </MotionDiv>
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.175 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/20"
            data-testid="codebase-total-size"
          >
            <Layers className="w-6 h-6 text-cyan-400 mb-2" />
            <div className="text-2xl font-bold text-white">{linesOfCode.total > 0 ? linesOfCode.total.toLocaleString() : '—'}</div>
            <div className="text-xs text-white/50">Total Code Size</div>
            <div className="text-xs text-cyan-400/80 mt-1">lines of code</div>
          </MotionDiv>
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
            data-testid="codebase-branches"
          >
            <GitBranch className="w-6 h-6 text-blue-400 mb-2" />
            <div className="text-2xl font-bold text-white">{branches}</div>
            <div className="text-xs text-white/50">Branches</div>
            <div className="text-xs text-blue-400/80 mt-1">{contributors} contributors</div>
          </MotionDiv>
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
            data-testid="codebase-health"
          >
            <Activity className="w-6 h-6 text-amber-400 mb-2" />
            <div className="text-2xl font-bold text-white">{healthScore}%</div>
            <div className="text-xs text-white/50">Health Score</div>
            <div className="text-xs text-amber-400/80 mt-1">{files.modified} files changed</div>
          </MotionDiv>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 rounded-2xl bg-white/5 border border-white/10"
          >
            <div className="text-sm text-white/60 mb-2">File Activity</div>
            <div className="flex gap-4">
              <div className="flex-1 text-center p-3 rounded-lg bg-green-500/10">
                <div className="text-xl font-bold text-green-400">{files.created}</div>
                <div className="text-xs text-white/40">Created</div>
              </div>
              <div className="flex-1 text-center p-3 rounded-lg bg-blue-500/10">
                <div className="text-xl font-bold text-blue-400">{files.modified}</div>
                <div className="text-xs text-white/40">Modified</div>
              </div>
              <div className="flex-1 text-center p-3 rounded-lg bg-red-500/10">
                <div className="text-xl font-bold text-red-400">{files.deleted}</div>
                <div className="text-xs text-white/40">Deleted</div>
              </div>
            </div>
          </MotionDiv>

          {buildSize && (buildSize.clientMB > 0 || buildSize.totalMB > 0) && (
            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20"
              data-testid="codebase-build-size"
            >
              <div className="text-sm text-white/60 mb-2">Build Size</div>
              <div className="flex gap-4">
                <div className="flex-1 text-center p-3 rounded-lg bg-pink-500/10">
                  <div className="text-xl font-bold text-pink-400">{buildSize.clientMB.toFixed(1)} MB</div>
                  <div className="text-xs text-white/40">Client Bundle</div>
                </div>
                <div className="flex-1 text-center p-3 rounded-lg bg-rose-500/10">
                  <div className="text-xl font-bold text-rose-400">{buildSize.totalMB.toFixed(1)} MB</div>
                  <div className="text-xs text-white/40">Total Dist</div>
                </div>
              </div>
              <div className="text-xs text-white/30 mt-2 text-center">Validates code efficiency vs bloat</div>
            </MotionDiv>
          )}
        </div>
      </MotionDiv>
    );
  }

  if (drilldown === 'mesh-connections') {
    const connections = meshConnections?.connections || { activeApis: 0, registeredEndpoints: 0, integratedApps: 0, webhooks: 0 };
    const recentActivity = meshConnections?.recentActivity || [];
    const narrative = meshConnections?.narrative || 'Loading mesh connection data...';

    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid="pulse-drilldown-mesh-connections"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Plug className="w-5 h-5 text-rose-400" />
            Developer Mesh Connections
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>

        <p className="text-sm text-white/60 bg-white/5 rounded-xl p-3 border border-white/10">
          {narrative}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 border border-rose-500/20"
            data-testid="mesh-active-apis"
          >
            <Server className="w-6 h-6 text-rose-400 mb-2" />
            <div className="text-2xl font-bold text-white">{connections.activeApis}</div>
            <div className="text-xs text-white/50">Active APIs</div>
          </MotionDiv>
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 to-fuchsia-500/10 border border-pink-500/20"
            data-testid="mesh-registered-endpoints"
          >
            <Link2 className="w-6 h-6 text-pink-400 mb-2" />
            <div className="text-2xl font-bold text-white">{connections.registeredEndpoints}</div>
            <div className="text-xs text-white/50">Registered Endpoints</div>
          </MotionDiv>
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 border border-fuchsia-500/20"
            data-testid="mesh-integrated-apps"
          >
            <Layers className="w-6 h-6 text-fuchsia-400 mb-2" />
            <div className="text-2xl font-bold text-white">{connections.integratedApps}</div>
            <div className="text-xs text-white/50">Integrated Apps</div>
          </MotionDiv>
          
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20"
            data-testid="mesh-webhooks"
          >
            <Zap className="w-6 h-6 text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-white">{connections.webhooks}</div>
            <div className="text-xs text-white/50">Webhooks</div>
          </MotionDiv>
        </div>

        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-2xl bg-white/5 border border-white/10"
        >
          <div className="text-sm text-white/60 mb-3">Recent Activity</div>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity, i) => (
                <MotionDiv
                  key={`${activity.endpoint}-${i}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'call' ? 'bg-green-400' :
                      activity.type === 'register' ? 'bg-blue-400' :
                      activity.type === 'webhook' ? 'bg-purple-400' : 'bg-gray-400'
                    }`} />
                    <span className="text-sm text-white font-mono truncate max-w-[180px]">{activity.endpoint}</span>
                  </div>
                  <span className="text-xs text-white/40">{new Date(activity.timestamp).toLocaleTimeString()}</span>
                </MotionDiv>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-center py-4">No recent activity</p>
          )}
        </MotionDiv>
      </MotionDiv>
    );
  }

  if (drilldown?.startsWith('my-endpoint-')) {
    const endpointId = drilldown.replace('my-endpoint-', '');
    const endpoint = myEndpoints.find(e => e.id === endpointId);
    
    if (!endpoint) {
      return (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-full gap-4"
        >
          <Server className="w-12 h-12 text-gray-400" />
          <p className="text-white/60">Endpoint not found</p>
          <Button onClick={() => setDrilldown(null)} variant="outline" size="sm" data-testid="button-back-pulse">
            Back
          </Button>
        </MotionDiv>
      );
    }

    const m = endpoint.metrics;

    return (
      <MotionDiv
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
        data-testid={`pulse-endpoint-detail-${endpointId}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-pink-400" />
            {endpoint.name}
          </h2>
          <Button onClick={() => setDrilldown(null)} variant="ghost" size="sm" className="text-white/60" data-testid="button-back-pulse">
            Back
          </Button>
        </div>
        
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-xs text-white/40 mb-1">Endpoint URL</div>
          <div className="text-sm text-white font-mono truncate">{endpoint.url}</div>
        </div>

        {m ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20"
                data-testid={`metric-calls-${endpointId}`}
              >
                <Activity className="w-5 h-5 text-pink-400 mb-2" />
                <div className="text-2xl font-bold text-white" data-testid={`text-endpoint-calls-${endpointId}`}>
                  {m.callsPerMinute.toFixed(1)}
                </div>
                <div className="text-xs text-white/50">calls/min</div>
              </MotionDiv>
              
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
                data-testid={`metric-latency-${endpointId}`}
              >
                <Timer className="w-5 h-5 text-green-400 mb-2" />
                <div className="text-2xl font-bold text-white" data-testid={`text-endpoint-latency-${endpointId}`}>
                  {m.latencyP50}ms
                </div>
                <div className="text-xs text-white/50">P50 latency</div>
              </MotionDiv>
              
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20"
                data-testid={`metric-efficiency-${endpointId}`}
              >
                <Zap className="w-5 h-5 text-yellow-400 mb-2" />
                <div className="text-2xl font-bold text-white" data-testid={`text-endpoint-efficiency-${endpointId}`}>
                  {m.payloadEfficiency}%
                </div>
                <div className="text-xs text-white/50">payload efficiency</div>
              </MotionDiv>
              
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20"
                data-testid={`metric-uptime-${endpointId}`}
              >
                <Shield className="w-5 h-5 text-cyan-400 mb-2" />
                <div className="text-2xl font-bold text-white" data-testid={`text-endpoint-uptime-${endpointId}`}>
                  {m.uptime.toFixed(1)}%
                </div>
                <div className="text-xs text-white/50">uptime</div>
              </MotionDiv>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-sm text-white/60">P95 Latency</span>
                <span className="text-sm text-white font-semibold">{m.latencyP95}ms</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-sm text-white/60">Total Calls</span>
                <span className="text-sm text-white font-semibold">{m.totalCalls.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-sm text-white/60">Error Rate</span>
                <span className={`text-sm font-semibold ${m.errorRate > 5 ? 'text-red-400' : 'text-green-400'}`}>
                  {m.errorRate.toFixed(2)}%
                </span>
              </div>
              {m.lastCallAt && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-sm text-white/60">Last Call</span>
                  <span className="text-sm text-white/80">{new Date(m.lastCallAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-white/50">No metrics data available yet</p>
            <p className="text-xs text-white/30 mt-1">Metrics will appear once the endpoint receives traffic</p>
          </div>
        )}
      </MotionDiv>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="pulse-mode"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Atlas Pulse</h1>
            <p className="text-sm text-white/50">Live substrate health</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            className="text-white/60"
            disabled={isFetching}
            data-testid="button-refresh-pulse"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {wallet && (
        <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
          <Button
            variant={!showMyPulse ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowMyPulse(false)}
            className={`flex-1 ${!showMyPulse ? 'bg-white/10 text-white' : 'text-white/50'}`}
            data-testid="button-toggle-global-pulse"
          >
            <Globe className="w-4 h-4 mr-2" />
            Global Pulse
          </Button>
          <Button
            variant={showMyPulse ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowMyPulse(true)}
            className={`flex-1 ${showMyPulse ? 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 text-white' : 'text-white/50'}`}
            data-testid="button-toggle-my-pulse"
          >
            <User className="w-4 h-4 mr-2" />
            My Pulse
          </Button>
        </div>
      )}

      {showMyPulse ? (
        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
          data-testid="section-my-pulse"
        >
          <div className="p-3 rounded-xl bg-gradient-to-r from-pink-500/5 to-rose-500/5 border border-pink-500/20">
            <div className="flex items-center gap-2 text-sm text-pink-300/80">
              <Shield className="w-4 h-4" />
              Metrics are computed from your registered endpoints
            </div>
          </div>

          {loadingMyEndpoints ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
              <p className="text-white/50">Loading your endpoints...</p>
            </div>
          ) : myEndpoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <Server className="w-12 h-12 text-gray-500" />
              <div>
                <p className="text-white/60 mb-1">No endpoints registered</p>
                <p className="text-xs text-white/40">Add endpoints in Settings to see your personalized Pulse.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myEndpoints.map((endpoint, i) => (
                <MotionDiv
                  key={endpoint.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setDrilldown(`my-endpoint-${endpoint.id}`)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/5 to-rose-500/5 border border-pink-500/20 cursor-pointer hover:from-pink-500/10 hover:to-rose-500/10 transition-colors"
                  data-testid={`card-endpoint-pulse-${endpoint.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-pink-400" />
                      <span className="text-white font-medium truncate max-w-[150px]">{endpoint.name}</span>
                    </div>
                    <ArrowUpDown className="w-4 h-4 text-white/30" />
                  </div>
                  
                  {endpoint.metrics ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex flex-col">
                        <span className="text-white/40 text-xs">Calls/min</span>
                        <span className="text-white font-semibold" data-testid={`text-endpoint-calls-${endpoint.id}`}>
                          {endpoint.metrics.callsPerMinute.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/40 text-xs">Latency P50</span>
                        <span className="text-white font-semibold" data-testid={`text-endpoint-latency-${endpoint.id}`}>
                          {endpoint.metrics.latencyP50}ms
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/40 text-xs">Efficiency</span>
                        <span className="text-white font-semibold" data-testid={`text-endpoint-efficiency-${endpoint.id}`}>
                          {endpoint.metrics.payloadEfficiency}%
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white/40 text-xs">Uptime</span>
                        <span className="text-white font-semibold" data-testid={`text-endpoint-uptime-${endpoint.id}`}>
                          {endpoint.metrics.uptime.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-white/40 text-center py-2">
                      No metrics yet
                    </div>
                  )}
                </MotionDiv>
              ))}
            </div>
          )}

          <Button
            onClick={fetchMyEndpoints}
            variant="ghost"
            size="sm"
            className="w-full text-white/50"
            disabled={loadingMyEndpoints}
            data-testid="button-refresh-my-endpoints"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingMyEndpoints ? 'animate-spin' : ''}`} />
            Refresh My Endpoints
          </Button>
        </MotionDiv>
      ) : (
        <>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MotionDiv
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20"
          data-testid="metric-live-users"
        >
          <Users className="w-6 h-6 text-cyan-400 mb-2" />
          <div className="text-2xl font-bold text-white">{metrics.liveUsers}</div>
          <div className="text-xs text-white/50">Live Now</div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20"
          data-testid="metric-visitors"
        >
          <TrendingUp className="w-6 h-6 text-violet-400 mb-2" />
          <div className="text-2xl font-bold text-white">{metrics.uniqueVisitors24h}</div>
          <div className="text-xs text-white/50">Visitors (24h)</div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20"
          data-testid="metric-messages"
        >
          <MessageSquare className="w-6 h-6 text-emerald-400 mb-2" />
          <div className="text-2xl font-bold text-white">{metrics.messagesToday}</div>
          <div className="text-xs text-white/50">Messages Today</div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
          data-testid="metric-catalog"
        >
          <Database className="w-6 h-6 text-amber-400 mb-2" />
          <div className="text-2xl font-bold text-white">{metrics.catalogItems.toLocaleString()}</div>
          <div className="text-xs text-white/50">Catalog Items</div>
        </MotionDiv>
      </div>

      <div className="text-xs text-white/30 text-center">
        Page Views: {metrics.totalPageViews.toLocaleString()} total
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('geo')}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
          data-testid="tile-geo"
        >
          <Globe className="w-5 h-5 text-cyan-400 mb-2" />
          <div className="text-sm font-medium text-white">Geography</div>
          <div className="text-xs text-white/40">{metrics.geoData.length} regions</div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('pages')}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
          data-testid="tile-pages"
        >
          <BarChart3 className="w-5 h-5 text-violet-400 mb-2" />
          <div className="text-sm font-medium text-white">Top Pages</div>
          <div className="text-xs text-white/40">{metrics.topPages.length} routes</div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('devices')}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
          data-testid="tile-devices"
        >
          <Monitor className="w-5 h-5 text-emerald-400 mb-2" />
          <div className="text-sm font-medium text-white">Devices</div>
          <div className="text-xs text-white/40">{metrics.devices.length + metrics.browsers.length} types</div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('traffic')}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
          data-testid="tile-traffic"
        >
          <Clock className="w-5 h-5 text-amber-400 mb-2" />
          <div className="text-sm font-medium text-white">Traffic</div>
          <div className="text-xs text-white/40">By hour</div>
        </MotionDiv>
      </div>

      {/* Engagement Analytics Section */}
      <div className="flex items-center gap-2 pt-4">
        <Layers className="w-4 h-4 text-pink-400" />
        <h2 className="text-sm font-semibold text-white/80">Engagement Analytics</h2>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('referrers')}
          className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/5 to-rose-500/5 border border-pink-500/20 cursor-pointer hover:from-pink-500/10 hover:to-rose-500/10 transition-colors"
          data-testid="tile-referrers"
        >
          <ExternalLink className="w-5 h-5 text-pink-400 mb-2" />
          <div className="text-sm font-medium text-white">Top Referrers</div>
          <div className="text-xs text-pink-400/80">{metrics.topReferrers.length} sources</div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('session-depth')}
          className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 cursor-pointer hover:from-indigo-500/10 hover:to-purple-500/10 transition-colors"
          data-testid="tile-session-depth"
        >
          <Layers className="w-5 h-5 text-indigo-400 mb-2" />
          <div className="text-sm font-medium text-white">Session Depth</div>
          <div className="text-xs text-indigo-400/80">{metrics.sessionDepth?.avgPagesPerSession || 0} pages/session</div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('time-on-surface')}
          className="p-4 rounded-2xl bg-gradient-to-br from-teal-500/5 to-cyan-500/5 border border-teal-500/20 cursor-pointer hover:from-teal-500/10 hover:to-cyan-500/10 transition-colors"
          data-testid="tile-time-on-surface"
        >
          <Timer className="w-5 h-5 text-teal-400 mb-2" />
          <div className="text-sm font-medium text-white">Time on Surface</div>
          <div className="text-xs text-teal-400/80">
            {metrics.timeOnSurface?.avgSeconds ? (
              metrics.timeOnSurface.avgSeconds < 60 
                ? `${metrics.timeOnSurface.avgSeconds}s avg`
                : `${Math.floor(metrics.timeOnSurface.avgSeconds / 60)}m avg`
            ) : '0s avg'}
          </div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('navigation-flow')}
          className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/5 to-amber-500/5 border border-orange-500/20 cursor-pointer hover:from-orange-500/10 hover:to-amber-500/10 transition-colors"
          data-testid="tile-navigation-flow"
        >
          <Compass className="w-5 h-5 text-orange-400 mb-2" />
          <div className="text-sm font-medium text-white">Navigation Flow</div>
          <div className="text-xs text-orange-400/80">{metrics.navigationFlow?.length || 0} transitions</div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('search-intent')}
          className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 cursor-pointer hover:from-blue-500/10 hover:to-cyan-500/10 transition-colors"
          data-testid="tile-search-intent"
        >
          <Search className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-sm font-medium text-white">Search Intent</div>
          <div className="text-xs text-blue-400/80">{metrics.searchIntentDensity?.avgSearchesPerUser || 0} searches/user</div>
        </MotionDiv>
      </div>

      {/* Growth Cards Section */}
      <div className="flex items-center gap-2 pt-4">
        <TrendingUp className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-white/80">Growth Cards</h2>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('surface-growth')}
          className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 cursor-pointer hover:from-cyan-500/10 hover:to-blue-500/10 transition-colors"
          data-testid="tile-surface-growth"
        >
          <div className="flex items-center justify-between mb-2">
            <Database className="w-5 h-5 text-cyan-400" />
            {surfaceGrowth?.success && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                surfaceGrowth.aggregateDeltas.today > 0 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-white/10 text-white/40'
              }`}>
                {surfaceGrowth.aggregateDeltas.today > 0 ? '+' : ''}{surfaceGrowth.aggregateDeltas.today} today
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-white">Surface Growth</div>
          <div className="text-xs text-cyan-400/80">
            {surfaceGrowth?.success ? `${surfaceGrowth.totals.total.toLocaleString()} items` : 'Loading...'}
          </div>
          <div className="flex gap-2 mt-2 text-xs text-white/30">
            <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" />{surfaceGrowth?.totals.games || 0}</span>
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{surfaceGrowth?.totals.ebooks || 0}</span>
            <span className="flex items-center gap-1"><Video className="w-3 h-3" />{surfaceGrowth?.totals.videos || 0}</span>
            <span className="flex items-center gap-1"><Package className="w-3 h-3" />{surfaceGrowth?.totals.products || 0}</span>
          </div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => codebaseGrowth?.success && setDrilldown('codebase-growth')}
          className={`p-4 rounded-2xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20 transition-colors ${codebaseGrowth?.success ? 'cursor-pointer hover:from-violet-500/10 hover:to-purple-500/10' : 'cursor-wait'}`}
          data-testid="tile-codebase-growth"
        >
          <div className="flex items-center justify-between mb-2">
            <GitCommit className={`w-5 h-5 text-violet-400 ${!codebaseGrowth?.success ? 'animate-pulse' : ''}`} />
            {codebaseGrowth?.success ? (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                codebaseGrowth.commits.today > 0 
                  ? 'bg-violet-500/20 text-violet-400' 
                  : 'bg-white/10 text-white/40'
              }`}>
                {codebaseGrowth.commits.today > 0 ? '+' : ''}{codebaseGrowth.commits.today} today
              </span>
            ) : (
              <span className="h-4 w-12 bg-white/5 rounded animate-pulse" />
            )}
          </div>
          <div className="text-sm font-medium text-white">Codebase Growth</div>
          <div className="text-xs text-violet-400/80">
            {codebaseGrowth?.success ? `${codebaseGrowth.healthScore}% health` : (
              <span className="inline-block h-3 w-16 bg-violet-400/20 rounded animate-pulse" />
            )}
          </div>
          <div className="flex gap-2 mt-2 text-xs text-white/30">
            {codebaseGrowth?.success ? (
              <>
                <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{codebaseGrowth.branches} branches</span>
                <span className="flex items-center gap-1"><Network className="w-3 h-3" />{codebaseGrowth.contributors} devs</span>
              </>
            ) : (
              <>
                <span className="h-3 w-14 bg-white/5 rounded animate-pulse" />
                <span className="h-3 w-10 bg-white/5 rounded animate-pulse" />
              </>
            )}
          </div>
        </MotionDiv>

        <MotionDiv
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setDrilldown('mesh-connections')}
          className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/5 to-pink-500/5 border border-rose-500/20 cursor-pointer hover:from-rose-500/10 hover:to-pink-500/10 transition-colors"
          data-testid="tile-mesh-connections"
        >
          <div className="flex items-center justify-between mb-2">
            <Plug className="w-5 h-5 text-rose-400" />
            {meshConnections?.success && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                meshConnections.connections.activeApis > 0 
                  ? 'bg-rose-500/20 text-rose-400' 
                  : 'bg-white/10 text-white/40'
              }`}>
                {meshConnections.connections.activeApis} active
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-white">Mesh Connections</div>
          <div className="text-xs text-rose-400/80">
            {meshConnections?.success ? `${meshConnections.connections.registeredEndpoints} endpoints` : 'Loading...'}
          </div>
          <div className="flex gap-2 mt-2 text-xs text-white/30">
            <span className="flex items-center gap-1"><Server className="w-3 h-3" />{meshConnections?.connections.activeApis || 0} APIs</span>
            <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{meshConnections?.connections.integratedApps || 0} apps</span>
          </div>
        </MotionDiv>
      </div>

      {efficiency && (
        <>
          <div className="flex items-center gap-2 pt-4">
            <Zap className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-white/80">Efficiency Cards</h2>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrilldown('eff-payload')}
              className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500/5 to-amber-500/5 border border-yellow-500/20 cursor-pointer hover:from-yellow-500/10 hover:to-amber-500/10 transition-colors"
              data-testid="tile-eff-payload"
            >
              <Zap className="w-5 h-5 text-yellow-400 mb-2" />
              <div className="text-sm font-medium text-white">Payload</div>
              <div className="text-xs text-yellow-400/80">{efficiency.payload.savingsPercent}% smaller</div>
            </MotionDiv>

            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrilldown('eff-latency')}
              className="p-4 rounded-2xl bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/20 cursor-pointer hover:from-green-500/10 hover:to-emerald-500/10 transition-colors"
              data-testid="tile-eff-latency"
            >
              <Timer className="w-5 h-5 text-green-400 mb-2" />
              <div className="text-sm font-medium text-white">Latency</div>
              <div className="text-xs text-green-400/80">{efficiency.latency.improvementPercent}% faster</div>
            </MotionDiv>

            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrilldown('eff-session')}
              className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 cursor-pointer hover:from-blue-500/10 hover:to-cyan-500/10 transition-colors"
              data-testid="tile-eff-session"
            >
              <Link2 className="w-5 h-5 text-blue-400 mb-2" />
              <div className="text-sm font-medium text-white">Sessions</div>
              <div className="text-xs text-blue-400/80">{efficiency.session.atlasSessionReuse}% reused</div>
            </MotionDiv>

            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrilldown('eff-developer')}
              className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/5 to-violet-500/5 border border-purple-500/20 cursor-pointer hover:from-purple-500/10 hover:to-violet-500/10 transition-colors"
              data-testid="tile-eff-developer"
            >
              <Code className="w-5 h-5 text-purple-400 mb-2" />
              <div className="text-sm font-medium text-white">Developer</div>
              <div className="text-xs text-purple-400/80">{efficiency.developer.reductionPercent}% simpler</div>
            </MotionDiv>

            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrilldown('eff-catalog')}
              className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/5 to-amber-500/5 border border-orange-500/20 cursor-pointer hover:from-orange-500/10 hover:to-amber-500/10 transition-colors"
              data-testid="tile-eff-catalog"
            >
              <Layers className="w-5 h-5 text-orange-400 mb-2" />
              <div className="text-sm font-medium text-white">Catalog</div>
              <div className="text-xs text-orange-400/80">{efficiency.catalog.automationPercent}% auto</div>
            </MotionDiv>

            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setDrilldown('eff-resource')}
              className="p-4 rounded-2xl bg-gradient-to-br from-teal-500/5 to-cyan-500/5 border border-teal-500/20 cursor-pointer hover:from-teal-500/10 hover:to-cyan-500/10 transition-colors"
              data-testid="tile-eff-resource"
            >
              <Battery className="w-5 h-5 text-teal-400 mb-2" />
              <div className="text-sm font-medium text-white">Resource</div>
              <div className="text-xs text-teal-400/80">{efficiency.resource.savingsPercent}% saved</div>
            </MotionDiv>
          </div>
        </>
      )}

      <div className="text-center text-xs text-white/20 pt-4">
        Data refreshes every 30 seconds • Last updated: {new Date(data?.timestamp || Date.now()).toLocaleTimeString()}
      </div>
      </>
      )}
    </MotionDiv>
  );
}
