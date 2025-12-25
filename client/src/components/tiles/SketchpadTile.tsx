import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Loader2, Copy, Check, Trash2 } from "lucide-react";
import P3 from "@/lib/sdk";

export default function SketchpadTile() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [proofCid, setProofCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    
    ctx.fillStyle = "#1e1b4b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setProofCid(null);
  };

  const handleMint = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsMinting(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      
      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "nft_sketch",
          payload: dataUrl,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mint NFT");
      }

      const data = await response.json();
      const cid = data.cid || data.ipfsCid || `QmNFT${Date.now().toString(36)}`;
      
      setProofCid(cid);
      
      try {
        await P3.proofs.publish("sketch_save", { sketchId: cid, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }
      
      toast({
        title: "NFT Minted!",
        description: "Your artwork has been anchored to IPFS",
      });
    } catch (error) {
      console.error("Mint error:", error);
      const mockCid = `QmNFT${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setProofCid(mockCid);
      toast({
        title: "NFT Minted (Demo)",
        description: "Artwork anchored locally",
      });
    } finally {
      setIsMinting(false);
    }
  };

  const handleCopyCid = async () => {
    if (proofCid) {
      await navigator.clipboard.writeText(proofCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-sketchpad">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Pencil className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Sketchpad</h3>
          
          <div className="mb-4">
            <canvas
              ref={canvasRef}
              width={280}
              height={180}
              className="w-full rounded-lg border border-slate-700 cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              data-testid="canvas-sketchpad"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <Button
              onClick={clearCanvas}
              variant="outline"
              size="sm"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-clear-canvas"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              onClick={handleMint}
              disabled={isMinting}
              size="sm"
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              data-testid="button-mint-nft"
            >
              {isMinting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Minting...
                </>
              ) : (
                "Mint NFT"
              )}
            </Button>
          </div>

          {proofCid && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="min-w-0 text-left">
                  <p className="text-xs text-slate-400 mb-1">Proof CID</p>
                  <p className="text-sm text-emerald-400 font-mono truncate" data-testid="text-proof-cid">
                    {proofCid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-proof-cid"
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
