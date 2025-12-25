import { Card, CardContent } from "@/components/ui/card";
import P3 from "@/lib/sdk";

export default function GameFPSTile() {
  const gameId = `fps-${Date.now()}`;

  async function handlePlay() {
    try {
      await P3.proofs.publish("game_start", { gameId, game: "arena_fps", score: 0, ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    window.open('/games/fps/', '_blank');
  }

  return (
    <Card 
      className="glass-card cursor-pointer hover:scale-105 transition-transform"
      onClick={handlePlay}
      data-testid="tile-arena-fps"
    >
      <CardContent className="p-6 text-center">
        <div className="text-4xl mb-2">🎯</div>
        <h3 className="text-lg font-semibold text-white">Arena FPS</h3>
        <p className="text-sm text-slate-400">Unreal Pixel Streaming</p>
        <span className="inline-block mt-2 px-2 py-1 text-xs bg-emerald-600/30 text-emerald-300 rounded">PWA</span>
      </CardContent>
    </Card>
  );
}
