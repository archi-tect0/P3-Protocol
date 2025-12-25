import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PieChart, BarChart, Pie, Bar, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, Globe, Filter, Smartphone, AlertTriangle, MessageSquare, CreditCard, Anchor, Download, RefreshCw, Database, Box, Wifi, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TelemetryDashboard from "@/components/admin/TelemetryDashboard";
import ComplianceExports from "@/components/admin/ComplianceExports";
import AdminLayout from "@/pages/admin/AdminLayout";

const COLORS = {
  primary: "#7c3aed",
  secondary: "#a78bfa",
  tertiary: "#c4b5fd",
  quaternary: "#ddd6fe",
  quinary: "#ede9fe",
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: liveData, isLoading: liveLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/metrics/live"],
    refetchInterval: 5000,
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/metrics/messages"],
    refetchInterval: 5000,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/metrics/payments"],
    refetchInterval: 5000,
  });

  const { data: anchoredData, isLoading: anchoredLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/metrics/anchored"],
    refetchInterval: 5000,
  });

  const { data: systemStatusData, isLoading: systemStatusLoading } = useQuery<{
    database: 'connected' | 'error';
    blockchain: 'connected' | 'error';
    ipfs: 'connected' | 'error';
    webrtc: 'connected' | 'error';
  }>({
    queryKey: ["/api/metrics/system-status"],
    refetchInterval: 10000,
  });

  const { data: geoData, isLoading: geoLoading } = useQuery<Array<{ name: string; value: number }>>({
    queryKey: ["/api/metrics/geo"],
    refetchInterval: 5000,
  });

  const { data: funnelData, isLoading: funnelLoading } = useQuery<Array<{ stage: string; count: number }>>({
    queryKey: ["/api/metrics/funnel"],
    refetchInterval: 5000,
  });

  const { data: devicesData, isLoading: devicesLoading } = useQuery<Array<{ device: string; count: number }>>({
    queryKey: ["/api/metrics/devices"],
    refetchInterval: 5000,
  });

  const { data: fraudData, isLoading: fraudLoading } = useQuery<Array<{
    id: string;
    type: string;
    severity: string;
    timestamp: string;
    details: string;
  }>>({
    queryKey: ["/api/metrics/fraud"],
    refetchInterval: 5000,
  });

  const handleRefreshData = async () => {
    await queryClient.invalidateQueries();
    toast({
      title: "Data refreshed",
      description: "All metrics have been updated",
    });
  };

  const handleExportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: {
        liveUsers: liveData?.count || 0,
        messages: messagesData?.count || 0,
        payments: paymentsData?.count || 0,
        anchored: anchoredData?.count || 0,
      },
      systemStatus: systemStatusData,
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report exported",
      description: "Dashboard report has been downloaded",
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Real-time metrics and insights for your application
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExportReport}
            variant="outline"
            size="sm"
            data-testid="button-export-report"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
          <Button
            onClick={handleRefreshData}
            variant="outline"
            size="sm"
            data-testid="button-refresh-data"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Live Users Card */}
        <Card data-testid="card-live-users" className="col-span-1 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-slate-900 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Live Users
            </CardTitle>
            <CardDescription>Currently active</CardDescription>
          </CardHeader>
          <CardContent>
            {liveLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {liveData?.count?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Messages Card */}
        <Card data-testid="card-messages" className="col-span-1 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Total Messages
            </CardTitle>
            <CardDescription>All messages sent</CardDescription>
          </CardHeader>
          <CardContent>
            {messagesLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {messagesData?.count?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Payments Card */}
        <Card data-testid="card-payments" className="col-span-1 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-slate-900 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
              Total Payments
            </CardTitle>
            <CardDescription>Transactions processed</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {paymentsData?.count?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Anchored Items Card */}
        <Card data-testid="card-anchored" className="col-span-1 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Anchor className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Anchored Items
            </CardTitle>
            <CardDescription>Blockchain-anchored</CardDescription>
          </CardHeader>
          <CardContent>
            {anchoredLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {anchoredData?.count?.toLocaleString() || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Geo Breakdown Pie Chart */}
        <Card data-testid="chart-geo" className="col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Geographic Breakdown
            </CardTitle>
            <CardDescription>User distribution by location</CardDescription>
          </CardHeader>
          <CardContent>
            {geoLoading ? (
              <LoadingSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={geoData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill={COLORS.primary}
                    dataKey="value"
                  >
                    {geoData?.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(148, 163, 184, 0.3)",
                      borderRadius: "0.5rem",
                      color: "#f8fafc",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Auth Funnel Bar Chart */}
        <Card data-testid="chart-funnel" className="col-span-1 md:col-span-2 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Authentication Funnel
            </CardTitle>
            <CardDescription>User journey through auth flow</CardDescription>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <LoadingSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelData}>
                  <XAxis
                    dataKey="stage"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(148, 163, 184, 0.3)",
                      borderRadius: "0.5rem",
                      color: "#f8fafc",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Device Breakdown Bar Chart */}
        <Card data-testid="chart-devices" className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Device Breakdown
            </CardTitle>
            <CardDescription>Users by device type</CardDescription>
          </CardHeader>
          <CardContent>
            {devicesLoading ? (
              <LoadingSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={devicesData} layout="vertical">
                  <XAxis
                    type="number"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <YAxis
                    dataKey="device"
                    type="category"
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(148, 163, 184, 0.3)",
                      borderRadius: "0.5rem",
                      color: "#f8fafc",
                    }}
                  />
                  <Bar dataKey="count" fill={COLORS.primary} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Fraud Signals Table */}
        <Card data-testid="table-fraud" className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Fraud Signals
            </CardTitle>
            <CardDescription>Recent fraud detection alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {fraudLoading ? (
              <LoadingSkeleton />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fraudData && fraudData.length > 0 ? (
                    fraudData.map((signal) => (
                      <TableRow key={signal.id}>
                        <TableCell className="font-medium text-slate-900 dark:text-white">
                          {signal.type}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              signal.severity === "high"
                                ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                                : signal.severity === "medium"
                                ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                                : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                            }`}
                          >
                            {signal.severity}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {new Date(signal.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {signal.details}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500 dark:text-slate-400">
                        No fraud signals detected
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Telemetry Dashboard Section */}
      <div className="mt-6 p-6 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <TelemetryDashboard />
      </div>

      {/* Compliance Exports Section */}
      <div className="mt-6">
        <ComplianceExports />
      </div>

      {/* System Status Section */}
      <div className="mt-6">
        <Card data-testid="card-system-status" className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              System Status
            </CardTitle>
            <CardDescription>Real-time health monitoring of core services</CardDescription>
          </CardHeader>
          <CardContent>
            {systemStatusLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Database Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <Database className={`w-6 h-6 ${systemStatusData?.database === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Database</div>
                    <div className={`text-sm ${systemStatusData?.database === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {systemStatusData?.database === 'connected' ? 'Connected' : 'Error'}
                    </div>
                  </div>
                </div>

                {/* Blockchain Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <Box className={`w-6 h-6 ${systemStatusData?.blockchain === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Blockchain</div>
                    <div className={`text-sm ${systemStatusData?.blockchain === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {systemStatusData?.blockchain === 'connected' ? 'Connected' : 'Error'}
                    </div>
                  </div>
                </div>

                {/* IPFS Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <Wifi className={`w-6 h-6 ${systemStatusData?.ipfs === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">IPFS</div>
                    <div className={`text-sm ${systemStatusData?.ipfs === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {systemStatusData?.ipfs === 'connected' ? 'Connected' : 'Error'}
                    </div>
                  </div>
                </div>

                {/* WebRTC Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <Video className={`w-6 h-6 ${systemStatusData?.webrtc === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">WebRTC</div>
                    <div className={`text-sm ${systemStatusData?.webrtc === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {systemStatusData?.webrtc === 'connected' ? 'Connected' : 'Error'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
}
