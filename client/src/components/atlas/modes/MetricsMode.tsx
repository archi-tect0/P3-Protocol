import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Zap, Shield, Activity, Globe, Database, Radio, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActivityPoint {
  time: string;
  sessions: number;
  anchored: number;
}

interface LiveMetrics {
  count: number;
}

interface AnchoredMetrics {
  count: number;
  breakdown: {
    messages: number;
    notes: number;
    payments: number;
  };
}

interface SystemStatus {
  database: 'connected' | 'error';
  blockchain: 'connected' | 'error';
  ipfs: 'connected' | 'error';
  webrtc: 'connected' | 'error';
}

interface GeoData {
  name: string;
  value: number;
}

interface DeviceData {
  device: string;
  count: number;
}

const COLORS = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function MetricsMode() {
  const { pushReceipt } = useAtlasStore();
  const [activityHistory, setActivityHistory] = useState<ActivityPoint[]>([]);
  const receiptPushedRef = useRef(false);

  const liveQuery = useQuery<LiveMetrics>({
    queryKey: ['/api/metrics/live'],
    refetchInterval: 10000,
  });

  const anchoredQuery = useQuery<AnchoredMetrics>({
    queryKey: ['/api/metrics/anchored'],
    refetchInterval: 30000,
  });

  const systemQuery = useQuery<SystemStatus>({
    queryKey: ['/api/metrics/system-status'],
    refetchInterval: 15000,
  });

  const geoQuery = useQuery<GeoData[]>({
    queryKey: ['/api/metrics/geo'],
    refetchInterval: 60000,
  });

  const devicesQuery = useQuery<DeviceData[]>({
    queryKey: ['/api/metrics/devices'],
    refetchInterval: 60000,
  });

  const isLoading = liveQuery.isLoading && anchoredQuery.isLoading && systemQuery.isLoading;
  const hasError = liveQuery.isError && anchoredQuery.isError;

  useEffect(() => {
    if (liveQuery.data && anchoredQuery.data) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      setActivityHistory(prev => {
        const newPoint: ActivityPoint = {
          time: timeStr,
          sessions: liveQuery.data?.count || 0,
          anchored: anchoredQuery.data?.count || 0,
        };
        const updated = [...prev, newPoint].slice(-12);
        return updated;
      });
    }
  }, [liveQuery.data, anchoredQuery.data]);

  useEffect(() => {
    if ((liveQuery.data || anchoredQuery.data) && !receiptPushedRef.current) {
      receiptPushedRef.current = true;
      pushReceipt({
        id: `receipt-metrics-${Date.now()}`,
        hash: `0x${Math.random().toString(16).slice(2, 18)}`,
        scope: 'atlas.metrics.live',
        endpoint: '/api/metrics/live',
        timestamp: Date.now()
      });
    }
  }, [liveQuery.data, anchoredQuery.data]);

  const systemStatusItems = systemQuery.data ? [
    { name: 'Database', status: systemQuery.data.database, icon: Database },
    { name: 'Blockchain', status: systemQuery.data.blockchain, icon: Shield },
    { name: 'IPFS', status: systemQuery.data.ipfs, icon: Globe },
    { name: 'WebRTC', status: systemQuery.data.webrtc, icon: Radio },
  ] : [];

  const healthyServices = systemStatusItems.filter(s => s.status === 'connected').length;
  const healthPercentage = systemStatusItems.length > 0 
    ? ((healthyServices / systemStatusItems.length) * 100).toFixed(1) 
    : '0';

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="metrics-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4" data-testid="metrics-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60">Failed to load metrics</p>
        <Button 
          variant="outline" 
          onClick={() => {
            liveQuery.refetch();
            anchoredQuery.refetch();
            systemQuery.refetch();
          }}
          className="border-white/20"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const apiUptime = systemQuery.data 
    ? ((Object.values(systemQuery.data).filter(s => s === 'connected').length / 4) * 100).toFixed(1)
    : '—';

  const metricsCards = [
    { 
      label: 'Live Sessions', 
      value: liveQuery.data?.count?.toString() || '0', 
      icon: Users,
      color: 'text-cyan-400',
      bgColor: 'from-cyan-400/20 to-cyan-600/10',
    },
    { 
      label: 'Anchored Items', 
      value: anchoredQuery.data?.count?.toString() || '0', 
      icon: Shield,
      color: 'text-purple-400',
      bgColor: 'from-purple-400/20 to-purple-600/10',
    },
    { 
      label: 'System Health', 
      value: `${healthPercentage}%`, 
      icon: Activity,
      color: healthyServices === systemStatusItems.length ? 'text-green-400' : 'text-amber-400',
      bgColor: healthyServices === systemStatusItems.length ? 'from-green-400/20 to-green-600/10' : 'from-amber-400/20 to-amber-600/10',
    },
    { 
      label: 'API Health', 
      value: `${apiUptime}%`, 
      icon: Zap,
      color: Number(apiUptime) >= 75 ? 'text-green-400' : 'text-amber-400',
      bgColor: Number(apiUptime) >= 75 ? 'from-green-400/20 to-green-600/10' : 'from-amber-400/20 to-amber-600/10',
    },
  ];

  return (
    <MotionDiv
      className="h-full overflow-auto p-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="metrics-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400/20 to-purple-400/20">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-metrics-title">
            Atlas Metrics
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {metricsCards.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <MotionDiv
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl bg-gradient-to-br ${metric.bgColor} border border-white/10`}
              data-testid={`metric-card-${index}`}
            >
              <div className={`flex items-center gap-2 ${metric.color} text-xs mb-2`}>
                <Icon className="w-3 h-3" />
                {metric.label}
              </div>
              <div className="text-2xl font-light text-white/90">
                {metric.value}
              </div>
            </MotionDiv>
          );
        })}
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="h-[200px] p-4 rounded-xl bg-white/5 border border-white/10 mb-6"
        data-testid="activity-chart"
      >
        <h3 className="text-sm font-medium text-white/60 mb-2">Live Activity</h3>
        {activityHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={activityHistory}>
              <defs>
                <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAnchored" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                stroke="#ffffff30" 
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="#ffffff30" 
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="sessions" 
                stroke="#06b6d4" 
                strokeWidth={2}
                fill="url(#colorSessions)"
                name="Sessions"
              />
              <Area 
                type="monotone" 
                dataKey="anchored" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                fill="url(#colorAnchored)"
                name="Anchored"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-white/40 text-sm">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Collecting activity data...
            </div>
          </div>
        )}
      </MotionDiv>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10"
        >
          <h3 className="text-sm font-medium text-white/60 mb-4">System Status</h3>
          <div className="grid grid-cols-2 gap-3">
            {systemStatusItems.map((item) => {
              const Icon = item.icon;
              const isHealthy = item.status === 'connected';
              return (
                <div 
                  key={item.name}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/5"
                  data-testid={`system-${item.name.toLowerCase()}`}
                >
                  <div className={`p-1.5 rounded-lg ${isHealthy ? 'bg-green-400/20' : 'bg-red-400/20'}`}>
                    <Icon className={`w-3 h-3 ${isHealthy ? 'text-green-400' : 'text-red-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/80">{item.name}</div>
                    <div className={`text-[10px] ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
                      {isHealthy ? 'Connected' : 'Error'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10"
        >
          <h3 className="text-sm font-medium text-white/60 mb-4">Anchored Breakdown</h3>
          {anchoredQuery.data?.breakdown ? (
            <div className="space-y-2">
              {Object.entries(anchoredQuery.data.breakdown).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-white/60 capitalize">{key}</span>
                  <span className="text-sm text-white/80">{value}</span>
                </div>
              ))}
            </div>
          ) : anchoredQuery.isLoading ? (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="text-white/40 text-sm">No anchor data available</div>
          )}
        </MotionDiv>
      </div>

      {geoQuery.isLoading ? (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="h-[200px] p-4 rounded-xl bg-white/5 border border-white/10 mb-6 flex items-center justify-center"
        >
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading geographic data...
          </div>
        </MotionDiv>
      ) : geoQuery.data && geoQuery.data.length > 0 ? (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="h-[200px] p-4 rounded-xl bg-white/5 border border-white/10 mb-6"
        >
          <h3 className="text-sm font-medium text-white/60 mb-4">Geographic Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={geoQuery.data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={2}
                dataKey="value"
              >
                {geoQuery.data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </MotionDiv>
      ) : (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="h-[100px] p-4 rounded-xl bg-white/5 border border-white/10 mb-6 flex items-center justify-center"
        >
          <div className="text-white/40 text-sm">No geographic data available</div>
        </MotionDiv>
      )}

      {devicesQuery.isLoading ? (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="h-[100px] p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading device data...
          </div>
        </MotionDiv>
      ) : devicesQuery.data && devicesQuery.data.length > 0 ? (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="h-[200px] p-4 rounded-xl bg-white/5 border border-white/10"
        >
          <h3 className="text-sm font-medium text-white/60 mb-4">Device Breakdown</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={devicesQuery.data}>
              <defs>
                <linearGradient id="colorDevice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="device" 
                stroke="#ffffff30" 
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="#ffffff30" 
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                fill="url(#colorDevice)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </MotionDiv>
      ) : (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="h-[100px] p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
        >
          <div className="text-white/40 text-sm">No device data available</div>
        </MotionDiv>
      )}

      <div className="mt-6 text-center text-white/30 text-xs">
        Data refreshes automatically every 10-60 seconds
      </div>
    </MotionDiv>
  );
}
