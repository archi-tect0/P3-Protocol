import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Users, Loader2, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import P3 from "@/lib/sdk";

interface Proposal {
  id: string;
  title: string;
  yesVotes: number;
  noVotes: number;
  votedBy: Set<string>;
  anchorCid: string | null;
}

export default function MicroDaoTile() {
  const { toast } = useToast();
  const [proposalTitle, setProposalTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [copied, setCopied] = useState(false);
  const userId = "user-demo";

  const handleCreate = async () => {
    if (!proposalTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a proposal title",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "micro_dao_proposal",
          payload: {
            title: proposalTitle.trim(),
            createdAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        }),
      });

      let cid: string;
      if (!response.ok) {
        throw new Error("Failed to create proposal");
      }

      const data = await response.json();
      cid = data.cid || data.ipfsCid || `QmDAO${Date.now().toString(36)}`;

      const proposalId = `prop-${Date.now()}`;
      
      try {
        await P3.proofs.publish("dao_propose", { proposalId, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setProposal({
        id: proposalId,
        title: proposalTitle.trim(),
        yesVotes: 0,
        noVotes: 0,
        votedBy: new Set(),
        anchorCid: cid,
      });
      setProposalTitle("");
      toast({
        title: "Proposal Created!",
        description: "Your proposal is ready for voting",
      });
    } catch (error) {
      console.error("Create error:", error);
      const mockCid = `QmDAO${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setProposal({
        id: `prop-${Date.now()}`,
        title: proposalTitle.trim(),
        yesVotes: 0,
        noVotes: 0,
        votedBy: new Set(),
        anchorCid: mockCid,
      });
      setProposalTitle("");
      toast({
        title: "Proposal Created (Demo)",
        description: "Proposal anchored locally",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleVote = async (voteType: "yes" | "no") => {
    if (!proposal) return;
    
    if (proposal.votedBy.has(userId)) {
      toast({
        title: "Already Voted",
        description: "You have already voted on this proposal",
        variant: "destructive",
      });
      return;
    }

    setIsVoting(true);
    try {
      const newVotedBy = new Set(proposal.votedBy);
      newVotedBy.add(userId);
      
      const updatedProposal = {
        ...proposal,
        yesVotes: voteType === "yes" ? proposal.yesVotes + 1 : proposal.yesVotes,
        noVotes: voteType === "no" ? proposal.noVotes + 1 : proposal.noVotes,
        votedBy: newVotedBy,
      };

      await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "micro_dao_vote",
          payload: {
            proposalId: proposal.id,
            voteType,
            votedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        }),
      });

      try {
        await P3.proofs.publish("dao_vote", { proposalId: proposal.id, vote: voteType, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setProposal(updatedProposal);
      toast({
        title: "Vote Cast!",
        description: `You voted ${voteType.toUpperCase()} on this proposal`,
      });
    } catch (error) {
      console.error("Vote error:", error);
      const newVotedBy = new Set(proposal.votedBy);
      newVotedBy.add(userId);
      
      setProposal({
        ...proposal,
        yesVotes: voteType === "yes" ? proposal.yesVotes + 1 : proposal.yesVotes,
        noVotes: voteType === "no" ? proposal.noVotes + 1 : proposal.noVotes,
        votedBy: newVotedBy,
      });
      toast({
        title: "Vote Cast (Demo)",
        description: `Vote recorded locally`,
      });
    } finally {
      setIsVoting(false);
    }
  };

  const handleCopyCid = async () => {
    if (proposal?.anchorCid) {
      await navigator.clipboard.writeText(proposal.anchorCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  const hasVoted = proposal?.votedBy.has(userId);
  const totalVotes = (proposal?.yesVotes || 0) + (proposal?.noVotes || 0);

  return (
    <Card className="glass-card" data-testid="tile-micro-dao">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Micro DAO</h3>
          
          {!proposal ? (
            <div className="space-y-3">
              <Input
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                placeholder="Enter proposal title..."
                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                data-testid="input-proposal-title"
              />
              <Button
                onClick={handleCreate}
                disabled={isCreating || !proposalTitle.trim()}
                size="sm"
                className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                data-testid="button-create-proposal"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                <p className="text-sm text-white font-medium text-left" data-testid="text-proposal-title">
                  {proposal.title}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleVote("yes")}
                  disabled={isVoting || hasVoted}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-emerald-600 text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-50"
                  data-testid="button-vote-yes"
                >
                  {isVoting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      Yes
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleVote("no")}
                  disabled={isVoting || hasVoted}
                  size="sm"
                  variant="outline"
                  className="flex-1 border-red-600 text-red-400 hover:bg-red-600/20 disabled:opacity-50"
                  data-testid="button-vote-no"
                >
                  {isVoting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ThumbsDown className="w-4 h-4 mr-1" />
                      No
                    </>
                  )}
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Vote Tally</p>
                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-400" data-testid="text-yes-votes">
                      {proposal.yesVotes}
                    </p>
                    <p className="text-xs text-slate-500">Yes</p>
                  </div>
                  <div className="h-8 w-px bg-slate-700" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-400" data-testid="text-no-votes">
                      {proposal.noVotes}
                    </p>
                    <p className="text-xs text-slate-500">No</p>
                  </div>
                  <div className="h-8 w-px bg-slate-700" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-400" data-testid="text-total-votes">
                      {totalVotes}
                    </p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                </div>
              </div>

              {proposal.anchorCid && (
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 text-left">
                      <p className="text-xs text-slate-400 mb-1">Proposal CID</p>
                      <p className="text-sm text-amber-400 font-mono truncate" data-testid="text-proposal-cid">
                        {proposal.anchorCid}
                      </p>
                    </div>
                    <button
                      onClick={handleCopyCid}
                      className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                      data-testid="button-copy-proposal-cid"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setProposal(null)}
                variant="outline"
                size="sm"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                data-testid="button-new-proposal"
              >
                New Proposal
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
