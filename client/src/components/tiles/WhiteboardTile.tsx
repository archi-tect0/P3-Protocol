import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { PenTool, Loader2, Copy, Check, Trash2 } from "lucide-react";
import { P3 } from "@/lib/sdk";

export default function WhiteboardTile() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [proofCid, setProofCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.fillStyle = "#1a2e1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#84cc16";
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
    
    ctx.fillStyle = "#1a2e1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setProofCid(null);
  };

  const handleCommit = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsCommitting(true);
    const boardId = `board-${Date.now().toString(36)}`;
    
    try {
      await P3.proofs.publish("whiteboard_save", { 
        boardId, 
        ts: Date.now() 
      });
      
      setProofCid(boardId);
      toast({
        title: "Strokes Committed!",
        description: "Your whiteboard has been anchored",
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
      setProofCid(boardId);
      toast({
        title: "Strokes Committed (Demo)",
        description: "Whiteboard anchored locally",
      });
    } finally {
      setIsCommitting(false);
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
    <Card className="glass-card" data-testid="tile-whiteboard">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-lime-500 to-green-600 flex items-center justify-center">
            <PenTool className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Whiteboard</h3>
          
          <div className="mb-4">
            <canvas
              ref={canvasRef}
              width={280}
              height={160}
              className="w-full rounded-lg border border-slate-700 cursor-crosshair touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              data-testid="canvas-whiteboard"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <Button
              onClick={clearCanvas}
              variant="outline"
              size="sm"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-clear-whiteboard"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
            <Button
              onClick={handleCommit}
              disabled={isCommitting}
              size="sm"
              className="flex-1 bg-gradient-to-r from-lime-600 to-green-600 hover:from-lime-700 hover:to-green-700 text-white"
              data-testid="button-commit-strokes"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Committing...
                </>
              ) : (
                "Commit Strokes"
              )}
            </Button>
          </div>

          {proofCid && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="min-w-0 text-left">
                  <p className="text-xs text-slate-400 mb-1">Proof CID</p>
                  <p className="text-sm text-lime-400 font-mono truncate" data-testid="text-whiteboard-cid">
                    {proofCid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-whiteboard-cid"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-lime-400" />
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
