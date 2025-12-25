import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";
import P3 from "@/lib/sdk";

export default function GameRacerTile() {
  const gameId = `racer-${Date.now()}`;

  async function handlePlay() {
    try {
      await P3.proofs.publish("game_start", { gameId, game: "speed_racer", score: 0, ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    window.open('/games/racer/', '_blank');
  }

  return (
    <Card className="glass-card overflow-hidden" data-testid="tile-game-racer">
      <CardContent className="p-0">
        <div className="relative h-32 bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
          <Car className="w-16 h-16 text-white/80" />
          <span className="absolute top-2 right-2 text-xs bg-black/30 px-2 py-1 rounded text-white">PWA</span>
        </div>
        <div className="p-4 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Speed Racer</h3>
          <Button onClick={handlePlay} data-testid="button-play-racer">Play</Button>
        </div>
      </CardContent>
    </Card>
  );
}
