import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { P3 } from "@/lib/sdk";

export default function GameReactionTile() {
  const handlePlay = async () => {
    const gameId = `game-${Date.now().toString(36)}`;
    try {
      await P3.proofs.publish("game_start", { 
        gameId, 
        game: "reaction_time", 
        score: 0, 
        ts: Date.now() 
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    window.open('/games/reaction/', '_blank');
  };

  return (
    <Card className="glass-card overflow-hidden" data-testid="tile-game-reaction">
      <CardContent className="p-0">
        <div className="relative h-32 bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center">
          <Target className="w-16 h-16 text-white/80" />
          <span className="absolute top-2 right-2 text-xs bg-black/30 px-2 py-1 rounded text-white">PWA</span>
        </div>
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Reaction Test</h3>
          <Button onClick={handlePlay} data-testid="button-play-reaction">Play</Button>
        </div>
      </CardContent>
    </Card>
  );
}
