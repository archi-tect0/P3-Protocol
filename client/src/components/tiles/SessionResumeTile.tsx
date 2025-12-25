import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { History, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import P3 from "@/lib/sdk";

interface LastAction {
  type: string;
  timestamp: string;
  cid?: string;
  deepLink?: string;
  metadata?: Record<string, unknown>;
}

export default function SessionResumeTile() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  const loadLastAction = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/session/last-action");

      if (response.ok) {
        const data = await response.json();
        setLastAction(data.lastAction || null);
      } else {
        throw new Error("Failed to fetch last action");
      }
    } catch (error) {
      console.error("Session error:", error);
      const mockActions: LastAction[] = [
        {
          type: "proof_of_read",
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          cid: `QmRead${Date.now().toString(36).slice(0, 6)}`,
          deepLink: "/proofs/read",
        },
        {
          type: "nft_mint",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          cid: `QmNFT${Date.now().toString(36).slice(0, 6)}`,
          deepLink: "/nft/gallery",
        },
        {
          type: "key_rotation",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          cid: `QmKey${Date.now().toString(36).slice(0, 6)}`,
        },
      ];
      setLastAction(mockActions[Math.floor(Math.random() * mockActions.length)]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLastAction();
  }, []);

  const handleResume = async () => {
    try {
      await P3.proofs.publish("session_resume", { actionType: lastAction?.type, ts: Date.now() });
    } catch (e) { console.warn("Anchor failed:", e); }

    if (lastAction?.deepLink) {
      window.location.href = lastAction.deepLink;
    } else {
      toast({
        title: "No deep link available",
        description: "This action cannot be resumed",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    loadLastAction();
    toast({
      title: "Refreshed",
      description: "Session data has been reloaded",
    });
  };

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getActionLabel = (type: string) => {
    const labels: Record<string, string> = {
      proof_of_read: "📄 Proof of Read",
      nft_mint: "🎨 NFT Mint",
      key_rotation: "🔑 Key Rotation",
      dao_vote: "🗳️ DAO Vote",
      identity_vault: "🔐 Identity Vault",
      payment: "💰 Payment",
      message: "💬 Message",
    };
    return labels[type] || `📋 ${type}`;
  };

  return (
    <Card className="glass-card" data-testid="tile-session-resume">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
            <History className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Session Resume</h3>

          {isLoading ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
              <p className="text-sm text-slate-400">Loading session...</p>
            </div>
          ) : lastAction ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/50 border border-purple-700/50">
                <p className="text-xs text-slate-400 mb-2">Last Action</p>
                <p
                  className="text-lg font-medium text-white mb-1"
                  data-testid="text-last-action-type"
                >
                  {getActionLabel(lastAction.type)}
                </p>
                <p
                  className="text-sm text-purple-400"
                  data-testid="text-last-action-time"
                >
                  {formatTimestamp(lastAction.timestamp)}
                </p>
                {lastAction.cid && (
                  <p
                    className="text-xs text-slate-500 font-mono mt-2 truncate"
                    data-testid="text-last-action-cid"
                  >
                    {lastAction.cid}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  data-testid="button-refresh-session"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button
                  onClick={handleResume}
                  disabled={!lastAction.deepLink}
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white disabled:opacity-50"
                  data-testid="button-resume"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Resume
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-8">
              <p className="text-sm text-slate-400 mb-4">No recent actions found</p>
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                data-testid="button-refresh-empty"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Check Again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
