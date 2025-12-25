import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Wifi } from "lucide-react";

interface ExternalAppTileProps {
  url: string;
  name: string;
  description: string;
  iconEmoji: string;
}

export default function ExternalAppTile({ url, name, description, iconEmoji }: ExternalAppTileProps) {
  const handleOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="glass-card" data-testid={`tile-external-app-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 flex items-center justify-center">
            <span className="text-2xl" data-testid="icon-external-app">{iconEmoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate" data-testid="text-app-name">
              {name}
            </h3>
            <p className="text-xs text-slate-400 truncate" data-testid="text-app-description">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400" data-testid="indicator-session-persistence">
            <Wifi className="w-3 h-3" />
            <span>Session Active</span>
          </div>

          <Button
            onClick={handleOpen}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-open-external-app"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
