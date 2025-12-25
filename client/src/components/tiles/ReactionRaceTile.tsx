import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, Trophy, Timer, Users } from "lucide-react";
import P3 from "@/lib/sdk";

type RaceState = "idle" | "waiting" | "active" | "finished";

interface RaceResult {
  winner: string;
  time: number;
  raceId: string;
}

export default function ReactionRaceTile() {
  const { toast } = useToast();
  const [raceState, setRaceState] = useState<RaceState>("idle");
  const [raceId, setRaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const generateRaceId = () => {
    return `RACE-${Date.now().toString(36).toUpperCase()}`;
  };

  const generateWalletAddress = () => {
    return `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
  };

  const handleCreateRace = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const newRaceId = generateRaceId();
      
      try {
        await P3.proofs.publish("race_create", { raceId: newRaceId, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }
      
      setRaceId(newRaceId);
      setRaceState("waiting");
      setResult(null);

      toast({
        title: "Race Created!",
        description: `Race ${newRaceId} is ready. Wait for the signal...`,
      });

      const waitTime = Math.floor(Math.random() * 3000) + 2000;
      
      setTimeout(() => {
        setRaceState("active");
        setCountdown(3);
        
        const countdownInterval = setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownInterval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);

        toast({
          title: "GO!",
          description: "Click fast to win!",
        });
      }, waitTime);

    } catch (error) {
      console.error("Race creation error:", error);
      toast({
        title: "Error",
        description: "Failed to create race",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = async () => {
    if (raceState !== "active") return;

    setIsLoading(true);
    try {
      const reactionTime = Math.floor(Math.random() * 500) + 100;
      const isWinner = Math.random() > 0.3;
      
      const winnerWallet = isWinner ? "You" : generateWalletAddress();

      setResult({
        winner: winnerWallet,
        time: reactionTime,
        raceId: raceId!,
      });
      setRaceState("finished");

      try {
        await P3.proofs.publish("race_result", { raceId, winner: winnerWallet, time: reactionTime, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      if (isWinner) {
        toast({
          title: "🏆 You Won!",
          description: `Reaction time: ${reactionTime}ms`,
        });
      } else {
        toast({
          title: "Close!",
          description: `${winnerWallet} was faster by ${Math.floor(Math.random() * 50) + 10}ms`,
        });
      }
    } catch (error) {
      console.error("Click error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewRace = () => {
    setRaceState("idle");
    setRaceId(null);
    setResult(null);
    setCountdown(null);
  };

  return (
    <Card className="glass-card" data-testid="tile-reaction-race">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-600/30 to-yellow-400/10">
            <Zap className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Reaction Race</h3>
            <p className="text-xs text-slate-400">Race to click first</p>
          </div>
        </div>

        <div className="space-y-4">
          {raceState === "idle" && (
            <div className="text-center py-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Users className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-400">Ready to compete?</span>
              </div>
              <Button
                onClick={handleCreateRace}
                disabled={isLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-semibold"
                data-testid="button-create-race"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Create Race
                  </>
                )}
              </Button>
            </div>
          )}

          {raceState === "waiting" && (
            <div className="text-center py-6">
              <div className="p-3 rounded-lg bg-slate-900/50 border border-yellow-700/50 mb-4">
                <p className="text-xs text-slate-400 mb-1">Race ID</p>
                <p className="text-lg font-mono text-yellow-400" data-testid="text-race-id">
                  {raceId}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-yellow-400 animate-pulse">
                <Timer className="w-5 h-5" />
                <span className="text-sm">Waiting for signal...</span>
              </div>
            </div>
          )}

          {raceState === "active" && (
            <div className="text-center py-4">
              {countdown !== null && (
                <div className="text-6xl font-bold text-yellow-400 mb-4 animate-bounce">
                  {countdown}
                </div>
              )}
              <Button
                onClick={handleClick}
                disabled={isLoading}
                className="w-full h-24 bg-gradient-to-br from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold text-xl animate-pulse"
                data-testid="button-click-fast"
              >
                {isLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-8 h-8 mr-2" />
                    CLICK FAST!
                  </>
                )}
              </Button>
            </div>
          )}

          {raceState === "finished" && result && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/50 border border-yellow-700/50 text-center">
                <Trophy className={`w-12 h-12 mx-auto mb-3 ${result.winner === "You" ? "text-yellow-400" : "text-slate-400"}`} />
                <p className="text-xs text-slate-400 mb-1">Winner</p>
                <p className={`text-lg font-bold ${result.winner === "You" ? "text-yellow-400" : "text-white"}`} data-testid="text-winner-wallet">
                  {result.winner}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Reaction Time</p>
                    <p className="text-sm font-mono text-yellow-400" data-testid="text-reaction-time">
                      {result.time}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Race ID</p>
                    <p className="text-sm font-mono text-slate-300">
                      {result.raceId}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleNewRace}
                variant="outline"
                className="w-full border-yellow-700 text-yellow-400 hover:bg-yellow-900/20"
                data-testid="button-new-race"
              >
                Start New Race
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
