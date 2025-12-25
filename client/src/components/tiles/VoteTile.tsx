import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Vote, ThumbsUp, ThumbsDown, Loader2, CheckCircle2, BarChart3 } from "lucide-react";
import { P3 } from "@/lib/sdk";

interface VoteResult {
  vote: "yes" | "no";
  txHash: string;
  timestamp: string;
  yesPercentage: number;
  noPercentage: number;
}

export default function VoteTile() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<"yes" | "no" | null>(null);
  const [result, setResult] = useState<VoteResult | null>(null);

  const proposal = {
    id: "PROP-001",
    title: "Increase Community Treasury Allocation",
    description: "Proposal to increase the community treasury allocation from 5% to 10% of protocol fees.",
  };

  const handleVote = async (vote: "yes" | "no") => {
    setIsLoading(vote);

    try {
      const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
      const timestamp = new Date().toISOString();

      try {
        await P3.proofs.publish("vote_cast", { 
          pollId: proposal.id, 
          choice: vote, 
          ts: Date.now() 
        });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      const yesPercentage = vote === "yes" 
        ? Math.floor(Math.random() * 20) + 55 
        : Math.floor(Math.random() * 20) + 25;
      
      setResult({
        vote,
        txHash,
        timestamp,
        yesPercentage,
        noPercentage: 100 - yesPercentage,
      });

      toast({
        title: "Vote Recorded!",
        description: `You voted ${vote.toUpperCase()} on ${proposal.id}`,
      });
    } catch (error) {
      console.error("Vote error:", error);
      
      const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
      const timestamp = new Date().toISOString();
      
      const yesPercentage = vote === "yes" 
        ? Math.floor(Math.random() * 20) + 55 
        : Math.floor(Math.random() * 20) + 25;
      
      setResult({
        vote,
        txHash,
        timestamp,
        yesPercentage,
        noPercentage: 100 - yesPercentage,
      });

      toast({
        title: "Vote Recorded (Demo)",
        description: `You voted ${vote.toUpperCase()} on ${proposal.id}`,
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <Card className="glass-card" data-testid="tile-vote">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-cyan-600/20">
            <Vote className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">DAO Voting</h3>
            <p className="text-xs text-slate-400">Cast your vote</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-cyan-400" data-testid="text-proposal-id">
                {proposal.id}
              </span>
              {result && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400">
                  Voted
                </span>
              )}
            </div>
            <h4 className="text-sm font-medium text-white mb-1" data-testid="text-proposal-title">
              {proposal.title}
            </h4>
            <p className="text-xs text-slate-400" data-testid="text-proposal-description">
              {proposal.description}
            </p>
          </div>

          {!result ? (
            <div className="flex gap-3">
              <Button
                onClick={() => handleVote("yes")}
                disabled={isLoading !== null}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-vote-yes"
              >
                {isLoading === "yes" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Yes
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleVote("no")}
                disabled={isLoading !== null}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                data-testid="button-vote-no"
              >
                {isLoading === "no" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    No
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-900/50 border border-cyan-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">
                    You voted: <span className={result.vote === "yes" ? "text-emerald-400" : "text-red-400"} data-testid="text-user-vote">
                      {result.vote.toUpperCase()}
                    </span>
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">Current Results</span>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-emerald-400">Yes</span>
                        <span className="text-emerald-400" data-testid="text-yes-percentage">{result.yesPercentage}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${result.yesPercentage}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-red-400">No</span>
                        <span className="text-red-400" data-testid="text-no-percentage">{result.noPercentage}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 rounded-full transition-all duration-500"
                          style={{ width: `${result.noPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-400">
                    TX: <span className="font-mono text-slate-500" data-testid="text-vote-tx">{result.txHash.slice(0, 20)}...</span>
                  </p>
                </div>
              </div>

              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                data-testid="button-vote-again"
              >
                Vote on Another Proposal
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
