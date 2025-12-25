import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import P3 from "@/lib/sdk";

export default function GameMazeTile() {
  const gameId = `maze-${Date.now()}`;

  async function handlePlay() {
    try {
      await P3.proofs.publish("game_start", { gameId, game: "maze_runner", score: 0, ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    window.open('/games/maze/', '_blank');
  }

  return (
    <Card className="glass-card overflow-hidden" data-testid="tile-game-maze">
      <CardContent className="p-0">
        <div className="relative h-32 bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center">
          <Compass className="w-16 h-16 text-white/80" />
          <span className="absolute top-2 right-2 text-xs bg-black/30 px-2 py-1 rounded text-white">PWA</span>
        </div>
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Maze Runner</h3>
          <Button onClick={handlePlay} data-testid="button-play-maze">Play</Button>
        </div>
      </CardContent>
    </Card>
  );
}
