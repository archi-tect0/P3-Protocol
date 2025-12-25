import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Award, Loader2, CheckCircle2, Lock, CreditCard, MessageSquare, Vote } from "lucide-react";
import P3 from "@/lib/sdk";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: typeof CreditCard;
  earned: boolean;
  eligible: boolean;
  claimedAt?: string;
}

export default function BadgeCollectorTile() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [badges, setBadges] = useState<Badge[]>([
    {
      id: "first-payment",
      name: "First Payment",
      description: "Complete your first payment",
      icon: CreditCard,
      earned: true,
      eligible: true,
      claimedAt: "2024-01-15",
    },
    {
      id: "first-message",
      name: "First Message",
      description: "Send your first message",
      icon: MessageSquare,
      earned: false,
      eligible: true,
    },
    {
      id: "first-vote",
      name: "First Vote",
      description: "Cast your first vote",
      icon: Vote,
      earned: false,
      eligible: false,
    },
  ]);

  const earnedCount = badges.filter((b) => b.earned).length;
  const totalCount = badges.length;

  const handleClaimBadge = async (badgeId: string) => {
    setIsLoading(badgeId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));

      setBadges((prev) =>
        prev.map((badge) =>
          badge.id === badgeId
            ? {
                ...badge,
                earned: true,
                claimedAt: new Date().toISOString().split("T")[0],
              }
            : badge
        )
      );

      const badge = badges.find((b) => b.id === badgeId);

      try {
        await P3.proofs.publish("badge_claim", { badgeId, badgeName: badge?.name, ts: Date.now() });
      } catch (e) { console.warn("Anchor failed:", e); }

      toast({
        title: "🎖️ Badge Earned!",
        description: `You've earned the "${badge?.name}" badge`,
      });
    } catch (error) {
      console.error("Badge claim error:", error);
      toast({
        title: "Error",
        description: "Failed to claim badge",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-badge-collector">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-600/30 to-amber-400/10">
            <Award className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Badge Collector</h3>
            <p className="text-xs text-slate-400">Earn badges for first actions</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-400" data-testid="text-badge-count">
              {earnedCount}/{totalCount}
            </p>
            <p className="text-xs text-slate-400">earned</p>
          </div>
        </div>

        <div className="space-y-3">
          {badges.map((badge) => {
            const IconComponent = badge.icon;
            return (
              <div
                key={badge.id}
                className={`p-3 rounded-lg border transition-all ${
                  badge.earned
                    ? "bg-amber-900/20 border-amber-700/50"
                    : badge.eligible
                    ? "bg-slate-900/50 border-slate-700 hover:border-amber-700/30"
                    : "bg-slate-900/30 border-slate-800"
                }`}
                data-testid={`badge-item-${badge.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      badge.earned
                        ? "bg-amber-600/30"
                        : badge.eligible
                        ? "bg-slate-800"
                        : "bg-slate-900"
                    }`}
                  >
                    <IconComponent
                      className={`w-5 h-5 ${
                        badge.earned
                          ? "text-amber-400"
                          : badge.eligible
                          ? "text-slate-400"
                          : "text-slate-600"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-medium ${
                          badge.earned ? "text-amber-400" : "text-white"
                        }`}
                        data-testid={`text-badge-name-${badge.id}`}
                      >
                        {badge.name}
                      </h4>
                      {badge.earned && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      {!badge.eligible && !badge.earned && (
                        <Lock className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {badge.description}
                    </p>
                    {badge.earned && badge.claimedAt && (
                      <p className="text-xs text-slate-500 mt-1">
                        Earned: {badge.claimedAt}
                      </p>
                    )}
                  </div>

                  {!badge.earned && (
                    <Button
                      onClick={() => handleClaimBadge(badge.id)}
                      disabled={isLoading !== null || !badge.eligible}
                      size="sm"
                      className={
                        badge.eligible
                          ? "bg-amber-600 hover:bg-amber-700 text-black font-medium"
                          : "bg-slate-800 text-slate-500 cursor-not-allowed"
                      }
                      data-testid={`button-claim-${badge.id}`}
                    >
                      {isLoading === badge.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : badge.eligible ? (
                        "Claim"
                      ) : (
                        "Locked"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {earnedCount === totalCount && (
          <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border border-amber-700/50 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-amber-400" />
            <p className="text-sm font-medium text-amber-400">
              🎉 All Badges Collected!
            </p>
            <p className="text-xs text-slate-400 mt-1">
              You're a P3 Hub champion
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
