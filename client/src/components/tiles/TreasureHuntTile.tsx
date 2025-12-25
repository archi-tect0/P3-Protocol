import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Map, Loader2, Send, Sparkles, Lock, CheckCircle2, XCircle } from "lucide-react";
import { P3 } from "@/lib/sdk";

interface HuntState {
  clue: string | null;
  solution: string | null;
  solved: boolean;
  solverWallet: string | null;
  anchorCid: string | null;
}

export default function TreasureHuntTile() {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [clueInput, setClueInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [huntState, setHuntState] = useState<HuntState>({
    clue: "What has keys but no locks, space but no room, and you can enter but can't go inside?",
    solution: "keyboard",
    solved: false,
    solverWallet: null,
    anchorCid: null,
  });

  const handlePostClue = async () => {
    if (!clueInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a clue",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      setHuntState({
        clue: clueInput,
        solution: null,
        solved: false,
        solverWallet: null,
        anchorCid: null,
      });
      setClueInput("");

      toast({
        title: "Clue Posted!",
        description: "The treasure hunt has begun",
      });
    } catch (error) {
      console.error("Clue posting error:", error);
      toast({
        title: "Error",
        description: "Failed to post clue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answerInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter an answer",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const isCorrect = answerInput.toLowerCase().trim() === huntState.solution?.toLowerCase();
      
      if (isCorrect) {
        const walletAddress = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
        const anchorCid = `QmTreasure${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

        try {
          await P3.proofs.publish("treasure_find", { 
            huntId: anchorCid, 
            itemId: answerInput, 
            ts: Date.now() 
          });
        } catch (e) {
          console.warn("Anchor failed:", e);
        }

        setHuntState((prev) => ({
          ...prev,
          solved: true,
          solverWallet: walletAddress,
          anchorCid,
        }));

        toast({
          title: "🎉 Correct!",
          description: "You solved the treasure hunt! Solution anchored.",
        });
      } else {
        toast({
          title: "Incorrect",
          description: "That's not the answer. Keep trying!",
          variant: "destructive",
        });
      }

      setAnswerInput("");
    } catch (error) {
      console.error("Answer submission error:", error);
      toast({
        title: "Error",
        description: "Failed to submit answer",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewHunt = () => {
    setHuntState({
      clue: null,
      solution: null,
      solved: false,
      solverWallet: null,
      anchorCid: null,
    });
    setIsAdmin(true);
  };

  return (
    <Card className="glass-card" data-testid="tile-treasure-hunt">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-600/30 to-emerald-400/10">
              <Map className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Treasure Hunt</h3>
              <p className="text-xs text-slate-400">Solve the clue to win</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdmin(!isAdmin)}
            className={`p-2 rounded-lg transition-colors ${
              isAdmin ? "bg-emerald-600/20 text-emerald-400" : "bg-slate-800 text-slate-400"
            }`}
            data-testid="button-toggle-admin"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {isAdmin && !huntState.clue && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                <p className="text-xs text-emerald-400 mb-2">Admin Mode</p>
                <p className="text-sm text-slate-300">Post a clue for players to solve</p>
              </div>
              <Input
                placeholder="Enter your clue..."
                value={clueInput}
                onChange={(e) => setClueInput(e.target.value)}
                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                data-testid="input-clue"
              />
              <Button
                onClick={handlePostClue}
                disabled={isLoading || !clueInput.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-post-clue"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Post Clue
                  </>
                )}
              </Button>
            </div>
          )}

          {huntState.clue && !huntState.solved && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/50 border border-emerald-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Current Clue</span>
                </div>
                <p className="text-sm text-white italic" data-testid="text-current-clue">
                  "{huntState.clue}"
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Your answer..."
                  value={answerInput}
                  onChange={(e) => setAnswerInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
                  className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                  data-testid="input-answer"
                />
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isLoading || !answerInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                  data-testid="button-submit-answer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {huntState.solved && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-emerald-900/20 border border-emerald-700/50 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-lg font-bold text-emerald-400 mb-2">Solved!</p>
                <p className="text-sm text-slate-300 mb-4">
                  The treasure has been found
                </p>
                
                <div className="space-y-2 text-left">
                  <div className="p-2 rounded bg-slate-900/50">
                    <p className="text-xs text-slate-400">Winner</p>
                    <p className="text-sm font-mono text-emerald-400" data-testid="text-solver-wallet">
                      {huntState.solverWallet}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-slate-900/50">
                    <p className="text-xs text-slate-400">Anchor CID</p>
                    <p className="text-sm font-mono text-slate-300 truncate" data-testid="text-anchor-cid">
                      {huntState.anchorCid}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleNewHunt}
                variant="outline"
                className="w-full border-emerald-700 text-emerald-400 hover:bg-emerald-900/20"
                data-testid="button-new-hunt"
              >
                Start New Hunt
              </Button>
            </div>
          )}

          {!huntState.clue && !isAdmin && (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm text-slate-400">No active treasure hunt</p>
              <p className="text-xs text-slate-500 mt-1">
                Toggle admin mode to create one
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
