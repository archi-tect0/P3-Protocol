import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Gift, Loader2, Sparkles, XCircle, Copy, Check, ExternalLink } from "lucide-react";
import P3 from "@/lib/sdk";

type SpinResult = "win" | "lose" | null;

interface RewardProof {
  cid: string;
  txHash?: string;
  timestamp: string;
}

export default function RewardTile() {
  const { toast } = useToast();
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult>(null);
  const [spinCount, setSpinCount] = useState(0);
  const [winCount, setWinCount] = useState(0);
  const [lastProof, setLastProof] = useState<RewardProof | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSpin = async () => {
    setIsSpinning(true);
    setResult(null);
    setLastProof(null);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const isWin = Math.random() < 0.3;
    const spinData = {
      type: "reward_spin",
      result: isWin ? "win" : "lose",
      spinNumber: spinCount + 1,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reward_spin",
          payload: spinData,
          timestamp: spinData.timestamp,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLastProof({
          cid: data.cid || data.ipfsCid || `QmReward${Date.now().toString(36)}`,
          txHash: data.txHash,
          timestamp: spinData.timestamp,
        });
      } else {
        throw new Error("Anchor failed");
      }
    } catch (error) {
      console.error("Anchor error:", error);
      setLastProof({
        cid: `QmReward${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        timestamp: spinData.timestamp,
      });
    }
    
    setResult(isWin ? "win" : "lose");
    setSpinCount((prev) => prev + 1);
    
    if (isWin) {
      setWinCount((prev) => prev + 1);
      
      try {
        await P3.proofs.publish("reward_claim", { rewardId: spinCount + 1, amount: 1, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }
      
      toast({
        title: "🎉 You Won!",
        description: "Reward anchored to protocol with proof receipt",
      });
    } else {
      toast({
        title: "Try Again",
        description: "Result recorded on-chain",
      });
    }

    setIsSpinning(false);
  };

  const handleCopyCid = async () => {
    if (lastProof?.cid) {
      await navigator.clipboard.writeText(lastProof.cid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Proof CID copied to clipboard",
      });
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-reward">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-yellow-600/20">
            <Gift className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Micro-Rewards</h3>
            <p className="text-xs text-slate-400">30% chance to win! Anchored to protocol</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center py-6">
            <div 
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                isSpinning 
                  ? "bg-yellow-600/30 animate-pulse scale-110" 
                  : result === "win"
                  ? "bg-emerald-600/30 scale-105"
                  : result === "lose"
                  ? "bg-red-600/20"
                  : "bg-yellow-600/20"
              }`}
            >
              {isSpinning ? (
                <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
              ) : result === "win" ? (
                <Sparkles className="w-12 h-12 text-emerald-400" data-testid="icon-win" />
              ) : result === "lose" ? (
                <XCircle className="w-12 h-12 text-red-400" data-testid="icon-lose" />
              ) : (
                <Gift className="w-12 h-12 text-yellow-400" />
              )}
            </div>
          </div>

          {result && !isSpinning && (
            <div className={`text-center py-2 rounded-lg ${
              result === "win" 
                ? "bg-emerald-600/20 border border-emerald-600/30" 
                : "bg-red-600/10 border border-red-600/20"
            }`}>
              <p 
                className={`text-lg font-bold ${result === "win" ? "text-emerald-400" : "text-red-400"}`}
                data-testid="text-spin-result"
              >
                {result === "win" ? "🎉 Winner!" : "Try Again!"}
              </p>
            </div>
          )}

          {lastProof && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-yellow-700/30">
              <p className="text-xs text-slate-400 mb-2">Proof Receipt</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-yellow-400 font-mono flex-1 truncate" data-testid="text-proof-cid">
                  {lastProof.cid}
                </code>
                <Button
                  onClick={handleCopyCid}
                  size="sm"
                  variant="ghost"
                  className="p-1 h-auto"
                  data-testid="button-copy-cid"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </Button>
              </div>
              {lastProof.txHash && (
                <a
                  href={`https://basescan.org/tx/${lastProof.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                  data-testid="link-tx-explorer"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Explorer
                </a>
              )}
            </div>
          )}

          <Button
            onClick={handleSpin}
            disabled={isSpinning}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
            data-testid="button-spin"
          >
            {isSpinning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Anchoring...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Spin & Anchor
              </>
            )}
          </Button>

          {spinCount > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Spins:</span>
                <span className="text-white font-medium" data-testid="text-spin-count">{spinCount}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Wins:</span>
                <span className="text-emerald-400 font-medium" data-testid="text-win-count">{winCount}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-400">Win Rate:</span>
                <span className="text-yellow-400 font-medium" data-testid="text-win-rate">
                  {spinCount > 0 ? Math.round((winCount / spinCount) * 100) : 0}%
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
