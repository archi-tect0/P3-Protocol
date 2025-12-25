import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, ExternalLink, Wifi, Users } from "lucide-react";
import { useAtlasStore } from "@/state/useAtlasStore";

export default function XboxGamingTile() {
  const setMode = useAtlasStore((s) => s.setMode);
  const setRenderPayload = useAtlasStore((s) => s.setRenderPayload);

  const handleOpenXbox = () => {
    setRenderPayload({ url: 'https://www.xbox.com/play', title: 'Xbox Cloud Gaming' });
    setMode('webBrowser');
  };

  return (
    <Card className="glass-card" data-testid="tile-xbox-gaming">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
            <Gamepad2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Xbox Cloud Gaming</h3>
            <p className="text-xs text-slate-400">Play Xbox games in the browser</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Wifi className="w-4 h-4 text-green-400" />
            <span>Stream 100+ games instantly</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users className="w-4 h-4 text-blue-400" />
            <span>Cross-platform multiplayer</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 mb-4">
          <p className="text-xs text-slate-400">
            Requires Xbox Game Pass Ultimate subscription. Games stream directly in Atlas.
          </p>
        </div>

        <Button
          onClick={handleOpenXbox}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium"
          data-testid="button-open-xbox"
        >
          <Gamepad2 className="w-4 h-4 mr-2" />
          Launch Xbox Cloud
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
