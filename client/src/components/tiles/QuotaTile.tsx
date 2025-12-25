import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Gauge, Loader2, CheckCircle2, XCircle } from "lucide-react";
import P3 from "@/lib/sdk";

export default function QuotaTile() {
  const { toast } = useToast();
  const [usedActions, setUsedActions] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const totalActions = 10;

  const quotaReached = usedActions >= totalActions;
  const percentage = (usedActions / totalActions) * 100;

  const handleUseAction = async () => {
    if (quotaReached) return;

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newCount = usedActions + 1;
      setUsedActions(newCount);

      try {
        await P3.proofs.publish("quota_use", { used: newCount, total: totalActions, ts: Date.now() });
      } catch (e) { console.warn("Anchor failed:", e); }

      if (newCount >= totalActions) {
        toast({
          title: "Quota Reached",
          description: "You've used all your daily actions. Resets at midnight.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Action Used",
          description: `${totalActions - newCount} actions remaining today`,
        });
      }
    } catch (error) {
      console.error("Action error:", error);
      toast({
        title: "Error",
        description: "Failed to use action",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setUsedActions(0);
    toast({
      title: "Quota Reset",
      description: "Your daily actions have been reset",
    });
  };

  return (
    <Card className="glass-card" data-testid="tile-quota">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-600/30 to-cyan-400/10">
            <Gauge className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Daily Quota</h3>
            <p className="text-xs text-slate-400">Track your daily actions</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-white mb-1" data-testid="text-quota-count">
              <span className={quotaReached ? "text-red-400" : "text-cyan-400"}>
                {usedActions}
              </span>
              <span className="text-slate-500">/{totalActions}</span>
            </div>
            <p className="text-sm text-slate-400">actions used today</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Progress</span>
              <span className={quotaReached ? "text-red-400" : "text-cyan-400"} data-testid="text-quota-percentage">
                {percentage}%
              </span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quotaReached
                    ? "bg-gradient-to-r from-red-600 to-red-400"
                    : "bg-gradient-to-r from-cyan-600 to-cyan-400"
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 py-2">
            {quotaReached ? (
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Quota reached</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm" data-testid="text-quota-remaining">
                  {totalActions - usedActions} actions remaining
                </span>
              </div>
            )}
          </div>

          <Button
            onClick={handleUseAction}
            disabled={isLoading || quotaReached}
            className={`w-full ${
              quotaReached
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-700 text-white"
            }`}
            data-testid="button-use-action"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : quotaReached ? (
              "Quota Reached"
            ) : (
              "Use Action"
            )}
          </Button>

          {quotaReached && (
            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-reset-quota"
            >
              Reset Quota (Demo)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
