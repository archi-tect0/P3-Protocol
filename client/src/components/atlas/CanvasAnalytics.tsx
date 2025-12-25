import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Globe, Monitor, Lock } from 'lucide-react';

interface ReferrerData {
  referrer: string;
  views: number;
}

interface PageData {
  route: string;
  views: number;
}

interface DeviceData {
  device: string;
  views: number;
}

interface BrowserData {
  browser: string;
  views: number;
}

interface AnalyticsOverviewProps {
  totalViews: number;
  uniqueVisitors: number;
  range: string;
  visibility?: 'public' | 'wallet-gated' | 'admin-only';
}

export function AnalyticsOverview({ totalViews, uniqueVisitors, range, visibility = 'admin-only' }: AnalyticsOverviewProps) {
  return (
    <Card data-testid="analytics-overview">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Overview
          </CardTitle>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            {visibility}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Last {range}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg" data-testid="analytics-total-views">
            <div className="text-3xl font-bold">{totalViews.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Page Views</div>
          </div>
          <div className="text-center p-4 bg-muted rounded-lg" data-testid="analytics-unique-visitors">
            <div className="text-3xl font-bold">{uniqueVisitors.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Unique Visitors</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ReferrersTableProps {
  referrers: ReferrerData[];
  range: string;
}

export function ReferrersTable({ referrers, range }: ReferrersTableProps) {
  const total = referrers.reduce((a, b) => a + b.views, 0);

  return (
    <Card data-testid="analytics-referrers">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Top Referrers
        </CardTitle>
        <p className="text-sm text-muted-foreground">Last {range}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {referrers.map((r, idx) => {
            const percent = total > 0 ? Math.round((r.views / total) * 100) : 0;
            return (
              <div key={idx} className="flex items-center gap-2" data-testid={`referrer-row-${idx}`}>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{r.referrer}</span>
                    <span className="text-sm text-muted-foreground">{r.views} ({percent}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface PagesTableProps {
  pages: PageData[];
  range: string;
}

export function PagesTable({ pages, range }: PagesTableProps) {
  return (
    <Card data-testid="analytics-pages">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Top Pages</CardTitle>
        <p className="text-sm text-muted-foreground">Last {range}</p>
      </CardHeader>
      <CardContent>
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-muted-foreground border-b">
              <th className="pb-2">Page</th>
              <th className="pb-2 text-right">Views</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p, idx) => (
              <tr key={idx} className="border-b last:border-0" data-testid={`page-row-${idx}`}>
                <td className="py-2 text-sm font-mono">{p.route}</td>
                <td className="py-2 text-sm text-right">{p.views.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

interface DevicesChartProps {
  devices: DeviceData[];
  browsers: BrowserData[];
  range: string;
}

export function DevicesChart({ devices, browsers, range }: DevicesChartProps) {
  const deviceTotal = devices.reduce((a, b) => a + b.views, 0);
  const browserTotal = browsers.reduce((a, b) => a + b.views, 0);

  return (
    <Card data-testid="analytics-devices">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Devices & Browsers
        </CardTitle>
        <p className="text-sm text-muted-foreground">Last {range}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-2">Devices</h4>
            <div className="space-y-1">
              {devices.map((d, idx) => {
                const percent = deviceTotal > 0 ? Math.round((d.views / deviceTotal) * 100) : 0;
                return (
                  <div key={idx} className="flex justify-between text-sm" data-testid={`device-row-${idx}`}>
                    <span>{d.device}</span>
                    <span className="text-muted-foreground">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Browsers</h4>
            <div className="space-y-1">
              {browsers.map((b, idx) => {
                const percent = browserTotal > 0 ? Math.round((b.views / browserTotal) * 100) : 0;
                return (
                  <div key={idx} className="flex justify-between text-sm" data-testid={`browser-row-${idx}`}>
                    <span>{b.browser}</span>
                    <span className="text-muted-foreground">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AnalyticsDashboardProps {
  data: {
    totalViews: number;
    uniqueVisitors: number;
    topReferrers: ReferrerData[];
    topPages: PageData[];
    topDevices: DeviceData[];
    topBrowsers: BrowserData[];
  };
  range: string;
}

export function AnalyticsDashboard({ data, range }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-4" data-testid="analytics-dashboard">
      <AnalyticsOverview 
        totalViews={data.totalViews} 
        uniqueVisitors={data.uniqueVisitors} 
        range={range} 
      />
      <div className="grid md:grid-cols-2 gap-4">
        <ReferrersTable referrers={data.topReferrers} range={range} />
        <PagesTable pages={data.topPages} range={range} />
      </div>
      <DevicesChart 
        devices={data.topDevices} 
        browsers={data.topBrowsers} 
        range={range} 
      />
    </div>
  );
}
