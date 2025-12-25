import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, MessageSquare, DollarSign, AlertTriangle, Users, Inbox, Globe, Monitor, Smartphone, ExternalLink } from "lucide-react";
import { useState } from "react";

interface TelemetryStats {
  activeSessions: number;
  messagesToday: number;
  paymentsToday: number;
  inboundQueue: number;
  quarantined: number;
  ipfsHealth: number;
}

interface SiteAnalytics {
  success: boolean;
  range: string;
  totalViews: number;
  uniqueVisitors: number;
  topPages: { route: string; views: number }[];
  topReferrers: { referrer: string; views: number }[];
  topDevices: { device: string; views: number }[];
  topBrowsers: { browser: string; views: number }[];
}

export default function TelemetryDashboard() {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');

  const { data: stats, isLoading: statsLoading } = useQuery<TelemetryStats>({
    queryKey: ["/api/admin/telemetry"],
    refetchInterval: 10000
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<SiteAnalytics>({
    queryKey: ["/api/admin/analytics", range],
    refetchInterval: 30000
  });

  const metrics = [
    { label: "Active Sessions", value: stats?.activeSessions || 0, icon: Users, color: "text-blue-500" },
    { label: "Messages Today", value: stats?.messagesToday || 0, icon: MessageSquare, color: "text-purple-500" },
    { label: "Payments Today", value: stats?.paymentsToday || 0, icon: DollarSign, color: "text-emerald-500" },
    { label: "Inbound Queue", value: stats?.inboundQueue || 0, icon: Inbox, color: "text-yellow-500" },
    { label: "Quarantined", value: stats?.quarantined || 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "IPFS Pin Health", value: `${stats?.ipfsHealth || 100}%`, icon: Activity, color: "text-cyan-500" }
  ];

  const isLoading = statsLoading || analyticsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="telemetry-dashboard">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Telemetry & Analytics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 animate-pulse">
              <CardContent className="p-4 h-20"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="telemetry-dashboard">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Telemetry & Analytics</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((m, i) => (
          <Card key={i} className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 backdrop-blur-sm" data-testid={`metric-${m.label.toLowerCase().replace(/\s/g, '-')}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <m.icon className={`w-8 h-8 ${m.color}`} />
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{m.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Site Analytics</h3>
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                range === r 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
              data-testid={`range-${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <Globe className="w-8 h-8 text-indigo-500" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Page Views</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{analytics?.totalViews || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardContent className="p-4 flex items-center gap-4">
            <Users className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Unique Visitors</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{analytics?.uniqueVisitors || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-orange-500" />
              Top Referrers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.topReferrers && analytics.topReferrers.length > 0 ? (
              <div className="space-y-2">
                {analytics.topReferrers.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{r.referrer}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{r.views}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No referrer data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.topPages && analytics.topPages.length > 0 ? (
              <div className="space-y-2">
                {analytics.topPages.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{p.route}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{p.views}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No page view data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="w-5 h-5 text-purple-500" />
              Browsers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.topBrowsers && analytics.topBrowsers.length > 0 ? (
              <div className="space-y-2">
                {analytics.topBrowsers.slice(0, 5).map((b, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{b.browser}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{b.views}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No browser data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-teal-500" />
              Devices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.topDevices && analytics.topDevices.length > 0 ? (
              <div className="space-y-2">
                {analytics.topDevices.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{d.device}</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{d.views}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">No device data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
