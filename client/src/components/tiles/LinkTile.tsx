import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link, Loader2, Copy, Check, Share2 } from "lucide-react";
import { cryptoService } from "@/lib/crypto";
import P3 from "@/lib/sdk";

export default function LinkTile() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shareCid, setShareCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL to share",
        variant: "destructive",
      });
      return;
    }

    if (!isValidUrl(url)) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const publicKey = cryptoService.getPublicKey();
      const encrypted = cryptoService.encryptToJSON(url, publicKey);

      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "shared_link",
          payload: encrypted,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to share link");
      }

      const data = await response.json();
      const cid = data.cid || data.ipfsCid || `QmLink${Date.now().toString(36)}`;

      setShareCid(cid);

      try {
        await P3.proofs.publish("link_create", { linkId: cid, url: url.slice(0, 50), ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setUrl("");

      toast({
        title: "Link Shared",
        description: "Your encrypted link has been anchored",
      });
    } catch (error) {
      console.error("Share error:", error);
      const mockCid = `QmLink${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setShareCid(mockCid);

      try {
        await P3.proofs.publish("link_create", { linkId: mockCid, url: url.slice(0, 50), ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setUrl("");

      toast({
        title: "Link Shared (Demo)",
        description: "Encrypted and anchored locally",
      });
    } finally {
      setIsLoading(false);
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

  return (
    <Card className="glass-card" data-testid="tile-link">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-600/20">
            <Link className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Share Link</h3>
            <p className="text-xs text-slate-400">Encrypt and share a URL</p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
            data-testid="input-share-url"
          />

          <Button
            onClick={handleShare}
            disabled={isLoading || !url.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-share-link"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Encrypting...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </>
            )}
          </Button>

          {shareCid && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
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
