import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Zap, Server, Users, Settings as SettingsIcon } from "lucide-react";
import AdminLayout from "./AdminLayout";

export default function HealthPage() {
  const { data: health, isLoading } = useQuery<{
    status: string;
    timestamp: string;
    metrics: {
      receiptsCount: number;
      ledgerEventsCount: number;
      usersCount: number;
      auditLogsCount: number;
    };
    system: {
      trustConfigCount: number;
      trustRulesActive: number;
      trustRulesTotal: number;
      pluginsEnabled: number;
      pluginsTotal: number;
      userCount: number;
      adminCount: number;
    };
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  }>({
    queryKey: ["/api/trust/health"],
    refetchInterval: 5000,
  });

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              System Health Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Real-time metrics and system status
            </p>
          </div>
          {health && (
            <Badge
              data-testid="badge-system-status"
              variant={health.status === "healthy" ? "default" : "destructive"}
              className="text-lg px-4 py-2"
            >
              {health.status === "healthy" ? "● HEALTHY" : "● UNHEALTHY"}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
        ) : health ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                icon={Database}
                title="Database"
                value={(health.metrics?.receiptsCount ?? 0).toLocaleString()}
                subtitle="Receipts"
              />
              <MetricCard
                icon={Zap}
                title="Ledger Events"
                value={(health.metrics?.ledgerEventsCount ?? 0).toLocaleString()}
                subtitle="Transactions"
              />
              <MetricCard
                icon={Users}
                title="Active Users"
                value={(health.metrics?.usersCount ?? 0).toLocaleString()}
                subtitle="Total users"
              />
              <MetricCard
                icon={Activity}
                title="Audit Logs"
                value={(health.metrics?.auditLogsCount ?? 0).toLocaleString()}
                subtitle="Log entries"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card data-testid="card-trust-layer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Trust Layer Status
                  </CardTitle>
                  <CardDescription>
                    Configuration and plugin health
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Trust Configurations
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-config-count">
                      {health.system.trustConfigCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Active Rules
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-rules-active">
                      {health.system.trustRulesActive} / {health.system.trustRulesTotal}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Enabled Plugins
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-plugins-enabled">
                      {health.system.pluginsEnabled} / {health.system.pluginsTotal}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Admin Users
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-admin-count">
                      {health.system.adminCount} / {health.system.userCount}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-system-resources">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    System Resources
                  </CardTitle>
                  <CardDescription>
                    Server performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Uptime
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-uptime">
                      {formatUptime(health.uptime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Memory (RSS)
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-memory-rss">
                      {formatBytes(health.memory.rss)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Heap Used
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-heap-used">
                      {formatBytes(health.memory.heapUsed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Heap Total
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white" data-testid="text-heap-total">
                      {formatBytes(health.memory.heapTotal)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-timestamp">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                  Last updated: {new Date(health.timestamp).toLocaleString()}
                  <span className="ml-2">● Auto-refreshing every 5 seconds</span>
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-slate-500 dark:text-slate-400">
                Failed to load health metrics
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

function MetricCard({ icon: Icon, title, value, subtitle }: {
  icon: any;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card data-testid={`card-metric-${title.toLowerCase().replace(' ', '-')}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
          <Icon className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid={`text-value-${title.toLowerCase().replace(' ', '-')}`}>
          {value}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );
}
