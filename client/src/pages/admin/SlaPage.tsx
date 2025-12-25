import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart3, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Zap,
  Server,
  Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminLayout from "./AdminLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

type TimePeriod = '24h' | '7d' | '30d';

interface SlaMetrics {
  uptime: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  requestsPerSecond: number;
  totalRequests: number;
}

const generateTimeSeriesData = (period: TimePeriod) => {
  const points = period === '24h' ? 24 : period === '7d' ? 7 : 30;
  const data = [];
  const now = new Date();
  
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(now);
    if (period === '24h') {
      date.setHours(date.getHours() - i);
    } else {
      date.setDate(date.getDate() - i);
    }
    
    data.push({
      time: period === '24h' 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      responseTime: Math.floor(150 + Math.random() * 100 + Math.sin(i * 0.5) * 50),
      p95: Math.floor(250 + Math.random() * 150 + Math.sin(i * 0.5) * 80),
      errorRate: Math.max(0, parseFloat((0.5 + Math.random() * 1.5 + Math.sin(i * 0.3) * 0.5).toFixed(2))),
      requests: Math.floor(1000 + Math.random() * 500 + Math.cos(i * 0.4) * 200),
    });
  }
  
  return data;
};

const staticMetrics: Record<TimePeriod, SlaMetrics> = {
  '24h': {
    uptime: 99.98,
    avgResponseTime: 187,
    p95ResponseTime: 312,
    p99ResponseTime: 489,
    errorRate: 0.42,
    requestsPerSecond: 156,
    totalRequests: 13478400,
  },
  '7d': {
    uptime: 99.95,
    avgResponseTime: 195,
    p95ResponseTime: 328,
    p99ResponseTime: 512,
    errorRate: 0.58,
    requestsPerSecond: 142,
    totalRequests: 85881600,
  },
  '30d': {
    uptime: 99.92,
    avgResponseTime: 201,
    p95ResponseTime: 345,
    p99ResponseTime: 534,
    errorRate: 0.71,
    requestsPerSecond: 138,
    totalRequests: 357523200,
  },
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card-admin rounded-xl p-6 h-32 bg-white/5" />
        ))}
      </div>
      <div className="glass-card-admin rounded-xl p-6 h-80 bg-white/5" />
    </div>
  );
}

function UptimeRing({ percentage }: { percentage: number }) {
  const radius = 80;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getColor = (pct: number) => {
    if (pct >= 99.9) return '#4fe1a8';
    if (pct >= 99.5) return '#22d3ee';
    if (pct >= 99) return '#facc15';
    return '#f87171';
  };
  
  const color = getColor(percentage);
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke="rgba(255,255,255,0.1)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-out' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-[#eaf6ff]">{percentage.toFixed(2)}%</span>
        <span className="text-xs text-slate-400">Uptime</span>
      </div>
    </div>
  );
}

function MetricCard({ 
  icon: Icon, 
  title, 
  value, 
  unit,
  trend, 
  trendUp,
  status
}: { 
  icon: typeof BarChart3; 
  title: string; 
  value: string | number; 
  unit?: string;
  trend?: string;
  trendUp?: boolean;
  status?: 'good' | 'warning' | 'critical';
}) {
  const statusColors = {
    good: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    critical: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="glass-card-admin rounded-xl p-5" data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-[#4fe1a8]/10">
          <Icon className="w-5 h-5 text-[#4fe1a8]" />
        </div>
        {status && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[status]}`}>
            {status === 'good' ? 'Healthy' : status === 'warning' ? 'Warning' : 'Critical'}
          </span>
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-[#eaf6ff]">{value}</span>
          {unit && <span className="text-sm text-slate-400">{unit}</span>}
        </div>
        <p className="text-sm text-slate-400 mt-1">{title}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ComplianceCard({ 
  title, 
  target, 
  actual, 
  compliant 
}: { 
  title: string; 
  target: string; 
  actual: string; 
  compliant: boolean; 
}) {
  return (
    <div 
      className={`glass-card-admin rounded-xl p-4 border ${
        compliant ? 'border-green-500/30' : 'border-red-500/30'
      }`}
      data-testid={`compliance-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-medium text-[#eaf6ff]">{title}</h4>
        {compliant ? (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-400" />
        )}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Target</span>
          <span className="text-slate-300">{target}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Actual</span>
          <span className={compliant ? 'text-green-400' : 'text-red-400'}>{actual}</span>
        </div>
      </div>
      <Badge 
        className={`mt-3 w-full justify-center ${
          compliant 
            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border-red-500/30'
        }`}
      >
        {compliant ? 'Compliant' : 'Non-Compliant'}
      </Badge>
    </div>
  );
}

export default function SlaPage() {
  const [period, setPeriod] = useState<TimePeriod>('24h');
  
  const { isLoading } = useQuery({
    queryKey: ['/api/enterprise/sla', period],
    retry: false,
    enabled: false,
  });

  const metrics = staticMetrics[period];
  const chartData = generateTimeSeriesData(period);

  const getResponseTimeStatus = (ms: number): 'good' | 'warning' | 'critical' => {
    if (ms <= 200) return 'good';
    if (ms <= 500) return 'warning';
    return 'critical';
  };

  const getErrorRateStatus = (rate: number): 'good' | 'warning' | 'critical' => {
    if (rate <= 0.5) return 'good';
    if (rate <= 1) return 'warning';
    return 'critical';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#eaf6ff]" data-testid="sla-title">
              SLA Metrics
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Monitor uptime, performance, and SLA compliance
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
            {(['24h', '7d', '30d'] as TimePeriod[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p)}
                className={period === p 
                  ? 'bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90' 
                  : 'text-slate-400 hover:text-[#eaf6ff] hover:bg-white/5'
                }
                data-testid={`button-period-${p}`}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="glass-card-admin rounded-xl p-6 flex flex-col items-center justify-center">
                <UptimeRing percentage={metrics.uptime} />
                <div className="mt-4 text-center">
                  <Badge className={`${
                    metrics.uptime >= 99.9 
                      ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                      : metrics.uptime >= 99.5 
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    {metrics.uptime >= 99.9 ? 'Excellent' : metrics.uptime >= 99.5 ? 'Good' : 'Needs Attention'}
                  </Badge>
                  <p className="text-xs text-slate-500 mt-2">
                    SLA Target: 99.9%
                  </p>
                </div>
              </div>

              <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                <MetricCard
                  icon={Clock}
                  title="Avg Response Time"
                  value={metrics.avgResponseTime}
                  unit="ms"
                  status={getResponseTimeStatus(metrics.avgResponseTime)}
                  trend="-12ms from last period"
                  trendUp={true}
                />
                <MetricCard
                  icon={Activity}
                  title="P95 Latency"
                  value={metrics.p95ResponseTime}
                  unit="ms"
                  status={getResponseTimeStatus(metrics.p95ResponseTime)}
                />
                <MetricCard
                  icon={AlertTriangle}
                  title="Error Rate"
                  value={metrics.errorRate.toFixed(2)}
                  unit="%"
                  status={getErrorRateStatus(metrics.errorRate)}
                  trend={metrics.errorRate < 0.5 ? '-0.1% from last period' : '+0.1% from last period'}
                  trendUp={metrics.errorRate < 0.5}
                />
                <MetricCard
                  icon={Zap}
                  title="Requests/sec"
                  value={metrics.requestsPerSecond}
                  unit="req/s"
                  trend="+8% from last period"
                  trendUp={true}
                />
              </div>
            </div>

            <div className="glass-card-admin rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#eaf6ff]">Response Time Trend</h3>
                  <p className="text-xs text-slate-400">Average and P95 latency over time</p>
                </div>
              </div>
              
              <div className="h-72" data-testid="chart-response-time">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4fe1a8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4fe1a8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="time" 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={11}
                      tickLine={false}
                      unit="ms"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(13, 27, 42, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#eaf6ff'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#4fe1a8" 
                      fill="url(#colorAvg)"
                      strokeWidth={2}
                      name="Avg Response"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="p95" 
                      stroke="#22d3ee" 
                      fill="url(#colorP95)"
                      strokeWidth={2}
                      name="P95 Latency"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card-admin rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#eaf6ff]">Error Rate Trend</h3>
                    <p className="text-xs text-slate-400">Percentage of failed requests</p>
                  </div>
                </div>
                
                <div className="h-48" data-testid="chart-error-rate">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="time" 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={10}
                        tickLine={false}
                        unit="%"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(13, 27, 42, 0.95)', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#eaf6ff'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="errorRate" 
                        stroke="#f87171" 
                        strokeWidth={2}
                        dot={false}
                        name="Error Rate"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card-admin rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Server className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#eaf6ff]">Request Volume</h3>
                    <p className="text-xs text-slate-400">Requests per interval</p>
                  </div>
                </div>
                
                <div className="h-48" data-testid="chart-requests">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="time" 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.3)" 
                        fontSize={10}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(13, 27, 42, 0.95)', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#eaf6ff'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="requests" 
                        stroke="#a855f7" 
                        fill="url(#colorReq)"
                        strokeWidth={2}
                        name="Requests"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="glass-card-admin rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[#4fe1a8]/20">
                  <CheckCircle2 className="w-5 h-5 text-[#4fe1a8]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#eaf6ff]">SLA Compliance Status</h3>
                  <p className="text-xs text-slate-400">Current period compliance against targets</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="compliance-cards">
                <ComplianceCard
                  title="Uptime"
                  target="≥ 99.9%"
                  actual={`${metrics.uptime.toFixed(2)}%`}
                  compliant={metrics.uptime >= 99.9}
                />
                <ComplianceCard
                  title="Avg Response Time"
                  target="≤ 200ms"
                  actual={`${metrics.avgResponseTime}ms`}
                  compliant={metrics.avgResponseTime <= 200}
                />
                <ComplianceCard
                  title="P95 Latency"
                  target="≤ 500ms"
                  actual={`${metrics.p95ResponseTime}ms`}
                  compliant={metrics.p95ResponseTime <= 500}
                />
                <ComplianceCard
                  title="Error Rate"
                  target="≤ 0.5%"
                  actual={`${metrics.errorRate.toFixed(2)}%`}
                  compliant={metrics.errorRate <= 0.5}
                />
              </div>
            </div>

            <div className="glass-card-admin rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Globe className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#eaf6ff]">Summary Statistics</h3>
                  <p className="text-xs text-slate-400">Aggregate metrics for the selected period</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-white/[0.02] text-center">
                  <p className="text-2xl font-bold text-[#eaf6ff]">
                    {(metrics.totalRequests / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Total Requests</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.02] text-center">
                  <p className="text-2xl font-bold text-[#eaf6ff]">
                    {metrics.p99ResponseTime}ms
                  </p>
                  <p className="text-xs text-slate-400 mt-1">P99 Latency</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.02] text-center">
                  <p className="text-2xl font-bold text-[#eaf6ff]">
                    {(100 - metrics.errorRate).toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Success Rate</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.02] text-center">
                  <p className="text-2xl font-bold text-[#4fe1a8]">
                    {metrics.uptime >= 99.9 && metrics.avgResponseTime <= 200 && metrics.errorRate <= 0.5 ? '4/4' : 
                     [metrics.uptime >= 99.9, metrics.avgResponseTime <= 200, metrics.p95ResponseTime <= 500, metrics.errorRate <= 0.5].filter(Boolean).length + '/4'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">SLA Targets Met</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .glass-card-admin {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </AdminLayout>
  );
}
