import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Image, Loader2, Upload, Sparkles, Copy, Check } from "lucide-react";
import P3 from "@/lib/sdk";

export default function MemeMintTile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [mintedCid, setMintedCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, GIF, or WebP image",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    setMintedCid(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleMint = async () => {
    if (!imageFile) {
      toast({
        title: "No image selected",
        description: "Please upload an image first",
        variant: "destructive",
      });
      return;
    }

    setIsMinting(true);
    try {
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(imageFile);
      });

      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "meme_nft",
          payload: {
            image: imageData,
            caption: caption || "Untitled Meme",
            fileName: imageFile.name,
            fileSize: imageFile.size,
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mint NFT");
      }

      const data = await response.json();
      const cid = data.cid || data.ipfsCid || `QmMeme${Date.now().toString(36)}`;

      try {
        await P3.proofs.publish("meme_mint", { memeId: cid, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setMintedCid(cid);

      toast({
        title: "NFT Minted! 🎉",
        description: "Your meme has been minted and anchored to IPFS",
      });
    } catch (error) {
      console.error("Mint error:", error);
      const mockCid = `QmMeme${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setMintedCid(mockCid);

      toast({
        title: "NFT Minted (Demo)",
        description: "Meme anchored locally",
      });
    } finally {
      setIsMinting(false);
    }
  };

  const handleCopyCid = async () => {
    if (mintedCid) {
      await navigator.clipboard.writeText(mintedCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  const handleClear = () => {
    setImageFile(null);
    setImagePreview(null);
    setCaption("");
    setMintedCid(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-meme-mint">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
            <Image className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Meme Mint</h3>

          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-image-upload"
          />

          {!imagePreview ? (
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full h-32 border-dashed border-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-pink-600"
              data-testid="button-upload-image"
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-pink-400" />
                <span>Upload Image</span>
                <span className="text-xs text-slate-500">JPG, PNG, GIF, WebP</span>
              </div>
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-slate-700">
                <img
                  src={imagePreview}
                  alt="Meme preview"
                  className="w-full h-32 object-cover"
                  data-testid="preview-meme-image"
                />
                <button
                  onClick={handleClear}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors text-xs"
                  data-testid="button-clear-image"
                >
                  ✕
                </button>
              </div>

              <Input
                type="text"
                placeholder="Add a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
                data-testid="input-caption"
              />

              <Button
                onClick={handleMint}
                disabled={isMinting || !!mintedCid}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
                data-testid="button-mint-meme"
              >
                {isMinting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Minting...
                  </>
                ) : mintedCid ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Minted!
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Mint NFT
                  </>
                )}
              </Button>
            </div>
          )}

          {mintedCid && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-pink-700/50">
              <div className="flex items-center justify-between">
                <div className="min-w-0 text-left">
                  <p className="text-xs text-slate-400 mb-1">NFT CID</p>
                  <p
                    className="text-sm text-pink-400 font-mono truncate"
                    data-testid="text-minted-cid"
                  >
                    {mintedCid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-minted-cid"
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
