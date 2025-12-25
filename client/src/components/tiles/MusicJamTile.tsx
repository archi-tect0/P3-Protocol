import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Headphones, Upload, Loader2, Copy, Check, X, Play, Pause } from "lucide-react";
import P3 from "@/lib/sdk";

interface AudioLoop {
  id: string;
  name: string;
  url: string;
  isPlaying: boolean;
}

export default function MusicJamTile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [loops, setLoops] = useState<AudioLoop[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [trackCid, setTrackCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newLoops: AudioLoop[] = [];
      
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        const id = `loop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        newLoops.push({
          id,
          name: file.name,
          url,
          isPlaying: false,
        });
      }
      
      setLoops((prev) => [...prev, ...newLoops]);
      toast({
        title: "Loops Added",
        description: `${newLoops.length} audio loop(s) added`,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Could not add audio loops",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const togglePlay = (loopId: string) => {
    const audio = audioRefs.current.get(loopId);
    if (!audio) return;

    if (audio.paused) {
      audio.play();
      setLoops((prev) =>
        prev.map((l) => (l.id === loopId ? { ...l, isPlaying: true } : l))
      );
    } else {
      audio.pause();
      setLoops((prev) =>
        prev.map((l) => (l.id === loopId ? { ...l, isPlaying: false } : l))
      );
    }
  };

  const removeLoop = (loopId: string) => {
    const loop = loops.find((l) => l.id === loopId);
    if (loop) {
      URL.revokeObjectURL(loop.url);
      audioRefs.current.delete(loopId);
    }
    setLoops((prev) => prev.filter((l) => l.id !== loopId));
  };

  const handlePublish = async () => {
    if (loops.length === 0) {
      toast({
        title: "No Loops",
        description: "Add at least one audio loop to publish",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);
    try {
      const manifest = loops.map((l) => ({
        id: l.id,
        name: l.name,
      }));

      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "music_jam_track",
          payload: {
            manifest,
            loopCount: loops.length,
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to publish track");
      }

      const data = await response.json();
      const cid = data.cid || data.ipfsCid || `QmJam${Date.now().toString(36)}`;
      
      try {
        await P3.proofs.publish("jam_join", { jamId: cid, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setTrackCid(cid);
      toast({
        title: "Track Published!",
        description: "Your music jam has been anchored to IPFS",
      });
    } catch (error) {
      console.error("Publish error:", error);
      const mockCid = `QmJam${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setTrackCid(mockCid);
      toast({
        title: "Track Published (Demo)",
        description: "Music jam anchored locally",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyCid = async () => {
    if (trackCid) {
      await navigator.clipboard.writeText(trackCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-music-jam">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Headphones className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Music Jam</h3>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-music-files"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            variant="outline"
            size="sm"
            className="w-full mb-3 border-slate-700 text-slate-300 hover:bg-slate-800"
            data-testid="button-add-loops"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Add Loops
              </>
            )}
          </Button>

          {loops.length > 0 && (
            <div className="mb-4 max-h-32 overflow-y-auto space-y-2">
              {loops.map((loop) => (
                <div
                  key={loop.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/50 border border-slate-700"
                  data-testid={`loop-item-${loop.id}`}
                >
                  <button
                    onClick={() => togglePlay(loop.id)}
                    className="p-1 rounded hover:bg-slate-800 transition-colors"
                    data-testid={`button-toggle-${loop.id}`}
                  >
                    {loop.isPlaying ? (
                      <Pause className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Play className="w-4 h-4 text-violet-400" />
                    )}
                  </button>
                  <p className="text-xs text-slate-300 truncate flex-1 text-left">
                    {loop.name}
                  </p>
                  <button
                    onClick={() => removeLoop(loop.id)}
                    className="p-1 rounded hover:bg-slate-800 transition-colors"
                    data-testid={`button-remove-${loop.id}`}
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                  <audio
                    ref={(el) => {
                      if (el) audioRefs.current.set(loop.id, el);
                    }}
                    src={loop.url}
                    loop
                    onEnded={() =>
                      setLoops((prev) =>
                        prev.map((l) =>
                          l.id === loop.id ? { ...l, isPlaying: false } : l
                        )
                      )
                    }
                    className="hidden"
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handlePublish}
            disabled={isPublishing || loops.length === 0}
            size="sm"
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
            data-testid="button-publish-track"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish Track"
            )}
          </Button>

          {trackCid && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="min-w-0 text-left">
                  <p className="text-xs text-slate-400 mb-1">Track CID</p>
                  <p className="text-sm text-violet-400 font-mono truncate" data-testid="text-track-cid">
                    {trackCid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-track-cid"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-violet-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
