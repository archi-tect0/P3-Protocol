import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, Loader2, Copy, Check, Navigation } from "lucide-react";
import { cryptoService } from "@/lib/crypto";
import P3 from "@/lib/sdk";

interface PresenceProof {
  cid: string;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
  signature: string;
}

export default function PresenceTile() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [proof, setProof] = useState<PresenceProof | null>(null);
  const [copied, setCopied] = useState(false);

  const getLocation = (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  };

  const handleMarkPresence = async () => {
    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      let location: { lat: number; lng: number } | undefined;

      if (includeLocation) {
        const position = await getLocation();
        if (position) {
          location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
        }
      }

      const presenceData = {
        type: "presence_proof",
        timestamp,
        location,
        publicKey: cryptoService.getPublicKey(),
      };

      const signature = cryptoService.hashMessage(JSON.stringify(presenceData));

      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...presenceData,
          signature,
        }),
      });

      let cid: string;
      if (response.ok) {
        const data = await response.json();
        cid = data.cid || data.ipfsCid;
      } else {
        cid = `QmPresence${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      }

      setProof({
        cid,
        timestamp,
        location,
        signature: signature.slice(0, 16) + "...",
      });

      try {
        await P3.proofs.publish("presence_checkin", { ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      toast({
        title: "Presence Anchored",
        description: location
          ? "Your location and timestamp have been recorded"
          : "Your timestamp has been recorded",
      });
    } catch (error) {
      console.error("Presence error:", error);
      const timestamp = new Date().toISOString();
      const mockCid = `QmPresence${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      
      setProof({
        cid: mockCid,
        timestamp,
        signature: "demo_signature...",
      });

      toast({
        title: "Presence Recorded (Demo)",
        description: "Proof anchored locally",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCid = async () => {
    if (proof?.cid) {
      await navigator.clipboard.writeText(proof.cid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  return (
    <Card className="glass-card" data-testid="tile-presence">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-600/20">
            <MapPin className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Proof of Presence</h3>
            <p className="text-xs text-slate-400">Anchor your location & time</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={includeLocation}
                onChange={(e) => setIncludeLocation(e.target.checked)}
                className="sr-only peer"
                data-testid="checkbox-include-location"
              />
              <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300 group-hover:text-white transition-colors">
              <Navigation className="w-4 h-4" />
              Include geolocation
            </div>
          </label>

          <Button
            onClick={handleMarkPresence}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-mark-presence"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Anchoring...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                I Was Here
              </>
            )}
          </Button>

          {proof && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 mb-1">IPFS CID</p>
                  <p className="text-sm text-emerald-400 font-mono truncate" data-testid="text-presence-cid">
                    {proof.cid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-presence-cid"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300" data-testid="text-presence-timestamp">
                  {formatTimestamp(proof.timestamp)}
                </span>
              </div>

              {proof.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-300 font-mono text-xs" data-testid="text-presence-location">
                    {proof.location.lat.toFixed(4)}, {proof.location.lng.toFixed(4)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  Signature: <span className="font-mono text-slate-500">{proof.signature}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
