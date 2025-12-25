import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Video, Phone, FileText, CreditCard, Vote, Settings, Shield, ExternalLink } from "lucide-react";

interface NexusLinkTileProps {
  id: string;
  name: string;
  description: string;
  route: string;
  gradient: string;
}

const iconMap: Record<string, typeof MessageSquare> = {
  messaging: MessageSquare,
  video: Video,
  voice: Phone,
  notes: FileText,
  payments: CreditCard,
  dao: Vote,
  settings: Settings,
  admin: Shield,
};

function NexusLinkTileContent({ id, name, description, route, gradient }: NexusLinkTileProps) {
  const Icon = iconMap[id] || MessageSquare;
  
  const handleOpen = () => {
    window.location.href = route;
  };

  return (
    <Card className="glass-card" data-testid={`tile-nexus-${id}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} bg-opacity-20`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{name}</h3>
            <p className="text-xs text-slate-400">Nexus Feature</p>
          </div>
        </div>
        
        <p className="text-sm text-slate-300 mb-4">{description}</p>
        
        <Button 
          onClick={handleOpen}
          className={`w-full bg-gradient-to-r ${gradient} hover:opacity-90`}
          data-testid={`button-open-${id}`}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in Nexus
        </Button>
      </CardContent>
    </Card>
  );
}

export function MessagingTile() {
  return (
    <NexusLinkTileContent
      id="messaging"
      name="Messages"
      description="End-to-end encrypted messaging with blockchain anchoring"
      route="/app"
      gradient="from-purple-500 to-indigo-600"
    />
  );
}

export function VideoCallsTile() {
  return (
    <NexusLinkTileContent
      id="video"
      name="Video Calls"
      description="Secure WebRTC video conferencing with receipt generation"
      route="/app"
      gradient="from-indigo-500 to-blue-600"
    />
  );
}

export function VoiceCallsTile() {
  return (
    <NexusLinkTileContent
      id="voice"
      name="Voice Calls"
      description="Encrypted voice calls with blockchain-anchored receipts"
      route="/app"
      gradient="from-green-500 to-emerald-600"
    />
  );
}

export function NotesTile() {
  return (
    <NexusLinkTileContent
      id="notes"
      name="Notes"
      description="Encrypted personal notes with IPFS storage"
      route="/app"
      gradient="from-amber-500 to-orange-600"
    />
  );
}

export function PaymentsTile() {
  return (
    <NexusLinkTileContent
      id="payments"
      name="Payments"
      description="ERC-20 token transfers with on-chain receipts"
      route="/app"
      gradient="from-cyan-500 to-blue-600"
    />
  );
}

export default NexusLinkTileContent;
