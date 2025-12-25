import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, Loader2, Wallet, MessageSquare } from "lucide-react";
import P3 from "@/lib/sdk";

interface WalletStats {
  paymentCount: number;
  messageCount: number;
  lastUpdated: string;
}

export default function AnalyticsTile() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<WalletStats | null>(null);

  const handleLoadStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/analytics/wallet-stats");
      
      if (response.ok) {
        const data = await response.json();
        const loadedStats = {
          paymentCount: data.paymentCount ?? 0,
          messageCount: data.messageCount ?? 0,
          lastUpdated: new Date().toISOString(),
        };
        setStats(loadedStats);

        try {
          await P3.proofs.publish("analytics_view", { paymentCount: loadedStats.paymentCount, messageCount: loadedStats.messageCount, ts: Date.now() });
        } catch (e) { console.warn("Anchor failed:", e); }
      } else {
        throw new Error("Failed to fetch stats");
      }

      toast({
        title: "Stats Loaded",
        description: "Wallet activity data has been refreshed",
      });
    } catch (error) {
      console.error("Analytics error:", error);
      const demoStats = {
        paymentCount: Math.floor(Math.random() * 50) + 5,
        messageCount: Math.floor(Math.random() * 100) + 10,
        lastUpdated: new Date().toISOString(),
      };
      setStats(demoStats);

      try {
        await P3.proofs.publish("analytics_view", { paymentCount: demoStats.paymentCount, messageCount: demoStats.messageCount, ts: Date.now() });
      } catch (e) { console.warn("Anchor failed:", e); }

      toast({
        title: "Stats Loaded (Demo)",
        description: "Showing sample analytics data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  return (
    <Card className="glass-card" data-testid="tile-analytics">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-indigo-600/20">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Wallet Analytics</h3>
            <p className="text-xs text-slate-400">View your activity stats</p>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleLoadStats}
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="button-load-stats"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4 mr-2" />
                Load Stats
              </>
            )}
          </Button>

          {stats && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-indigo-600/10 border border-indigo-600/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs text-slate-400">Payments</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-400" data-testid="text-payment-count">
                    {stats.paymentCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-indigo-600/10 border border-indigo-600/20">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs text-slate-400">Messages</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-400" data-testid="text-message-count">
                    {stats.messageCount}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-400" data-testid="text-stats-updated">
                  Updated: {formatTimestamp(stats.lastUpdated)}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
