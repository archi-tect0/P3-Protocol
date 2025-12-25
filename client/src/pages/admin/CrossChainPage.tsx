import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Network, Activity, Clock, CheckCircle2, XCircle } from "lucide-react";
import AdminLayout from "./AdminLayout";

export default function CrossChainPage() {
  const chains = [
    { id: "1", name: "Ethereum Mainnet", chainId: "1", status: "active", blockHeight: "18234567", lastSync: "2s ago", relayHealth: "healthy" },
    { id: "137", name: "Polygon", chainId: "137", status: "active", blockHeight: "49876543", lastSync: "1s ago", relayHealth: "healthy" },
    { id: "42161", name: "Arbitrum One", chainId: "42161", status: "active", blockHeight: "165432109", lastSync: "3s ago", relayHealth: "healthy" },
    { id: "10", name: "Optimism", chainId: "10", status: "active", blockHeight: "112345678", lastSync: "4s ago", relayHealth: "degraded" },
    { id: "8453", name: "Base", chainId: "8453", status: "active", blockHeight: "9876543", lastSync: "2s ago", relayHealth: "healthy" },
  ];

  const bridgeEvents = [
    { id: "1", from: "Ethereum", to: "Polygon", amount: "100 USDC", status: "completed", timestamp: "2 min ago", txHash: "0xabc123..." },
    { id: "2", from: "Polygon", to: "Arbitrum", amount: "50 ETH", status: "pending", timestamp: "5 min ago", txHash: "0xdef456..." },
    { id: "3", from: "Optimism", to: "Ethereum", amount: "1000 DAI", status: "completed", timestamp: "10 min ago", txHash: "0xghi789..." },
    { id: "4", from: "Base", to: "Ethereum", amount: "25 USDT", status: "failed", timestamp: "15 min ago", txHash: "0xjkl012..." },
  ];

  const relayStats = {
    totalBridges: 1234,
    activeBridges: 8,
    totalVolume: "$12.5M",
    avgBridgeTime: "4.2 min",
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Cross-Chain Bridge Monitor
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track multi-chain relay status and bridge operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card data-testid="card-total-bridges">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Bridges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {relayStats.totalBridges.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-active-bridges">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Active Bridges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {relayStats.activeBridges}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-volume">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {relayStats.totalVolume}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-avg-time">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Avg Bridge Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {relayStats.avgBridgeTime}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6" data-testid="card-chain-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Chain Status
            </CardTitle>
            <CardDescription>
              Real-time status of connected blockchains
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chain</TableHead>
                  <TableHead>Chain ID</TableHead>
                  <TableHead>Block Height</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Relay Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chains.map((chain) => (
                  <TableRow key={chain.id} data-testid={`row-chain-${chain.id}`}>
                    <TableCell className="font-medium text-slate-900 dark:text-white">
                      {chain.name}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {chain.chainId}
                      </code>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-block-${chain.id}`}>
                      {chain.blockHeight}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {chain.lastSync}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={chain.relayHealth === "healthy" ? "default" : "secondary"}
                        data-testid={`badge-health-${chain.id}`}
                      >
                        {chain.relayHealth === "healthy" ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : (
                          <Activity className="w-3 h-3 mr-1" />
                        )}
                        {chain.relayHealth}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card data-testid="card-bridge-events">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Recent Bridge Events
            </CardTitle>
            <CardDescription>
              Latest cross-chain transfers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>TX Hash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridgeEvents.map((event) => (
                  <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                    <TableCell className="font-medium text-slate-900 dark:text-white">
                      {event.from}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-white">
                      {event.to}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400" data-testid={`text-amount-${event.id}`}>
                      {event.amount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          event.status === "completed" ? "default" :
                          event.status === "pending" ? "secondary" :
                          "destructive"
                        }
                        data-testid={`badge-status-${event.id}`}
                      >
                        {event.status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {event.status === "failed" && <XCircle className="w-3 h-3 mr-1" />}
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {event.timestamp}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {event.txHash}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
