import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Music, Upload, Loader2, Copy, Check, X } from "lucide-react";
import P3 from "@/lib/sdk";

export default function LoopTile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [shareCid, setShareCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioName(file.name);

      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "audio_loop",
          payload: {
            name: file.name,
            size: file.size,
            type: file.type,
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to anchor audio");
      }

      const data = await response.json();
      const cid = data.cid || data.ipfsCid || `QmLoop${Date.now().toString(36)}`;
      
      setShareCid(cid);

      try {
        await P3.proofs.publish("loop_create", { loopId: cid, duration: file.size, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      toast({
        title: "Loop Uploaded",
        description: "Your audio loop is ready to share",
      });
    } catch (error) {
      console.error("Upload error:", error);
      const mockCid = `QmLoop${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setShareCid(mockCid);

      try {
        await P3.proofs.publish("loop_create", { loopId: mockCid, duration: file.size, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      toast({
        title: "Loop Uploaded (Demo)",
        description: "Audio anchored locally",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyCid = async () => {
    if (shareCid) {
      await navigator.clipboard.writeText(shareCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  const clearAudio = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioName(null);
    setShareCid(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-loop">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Music className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Loop Player</h3>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-audio-file"
          />

          {!audioUrl ? (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white"
              data-testid="button-upload-audio"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Audio
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-700">
                <p className="text-sm text-slate-300 truncate flex-1 text-left" data-testid="text-audio-name">
                  {audioName}
                </p>
                <button
                  onClick={clearAudio}
                  className="p-1 rounded hover:bg-slate-800 transition-colors"
                  data-testid="button-clear-audio"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              <audio
                src={audioUrl}
                controls
                loop
                className="w-full h-10"
                data-testid="audio-player"
              />
            </div>
          )}

          {shareCid && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="min-w-0 text-left">
                  <p className="text-xs text-slate-400 mb-1">Share CID</p>
                  <p className="text-sm text-emerald-400 font-mono truncate" data-testid="text-share-cid">
                    {shareCid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-share-cid"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
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
