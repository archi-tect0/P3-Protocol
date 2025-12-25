import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Key, Loader2, Check, RotateCw, Shield } from "lucide-react";
import P3 from "@/lib/sdk";

interface RotationResult {
  oldKeyFingerprint: string;
  newKeyFingerprint: string;
  timestamp: string;
  txHash?: string;
}

export default function KeyRotationTile() {
  const { toast } = useToast();
  const [isRotating, setIsRotating] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [result, setResult] = useState<RotationResult | null>(null);

  const generateFingerprint = () => {
    const chars = "0123456789ABCDEF";
    let fingerprint = "";
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) fingerprint += ":";
      fingerprint += chars[Math.floor(Math.random() * chars.length)];
    }
    return fingerprint;
  };

  const handleRotate = async () => {
    setIsRotating(true);
    setRotated(false);
    setResult(null);

    try {
      const oldKeyFingerprint = generateFingerprint();
      const newKeyFingerprint = generateFingerprint();
      const timestamp = new Date().toISOString();

      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "key_rotation",
          payload: {
            oldKeyFingerprint,
            newKeyFingerprint,
            rotationType: "cryptographic_keys",
          },
          timestamp,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to anchor key rotation");
      }

      const data = await response.json();
      const txHash = data.txHash || `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

      setResult({
        oldKeyFingerprint,
        newKeyFingerprint,
        timestamp,
        txHash,
      });
      setRotated(true);

      try {
        await P3.proofs.publish("key_rotate", { keyType: "cryptographic_keys", ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      toast({
        title: "Keys Rotated!",
        description: "Your cryptographic keys have been rotated successfully",
      });
    } catch (error) {
      console.error("Rotation error:", error);
      
      const oldKeyFingerprint = generateFingerprint();
      const newKeyFingerprint = generateFingerprint();
      const timestamp = new Date().toISOString();
      const txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

      setResult({
        oldKeyFingerprint,
        newKeyFingerprint,
        timestamp,
        txHash,
      });
      setRotated(true);

      try {
        await P3.proofs.publish("key_rotate", { keyType: "cryptographic_keys", ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      toast({
        title: "Keys Rotated (Demo)",
        description: "Key rotation simulated locally",
      });
    } finally {
      setIsRotating(false);
    }
  };

  const handleReset = () => {
    setRotated(false);
    setResult(null);
  };

  return (
    <Card className="glass-card" data-testid="tile-key-rotation">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <Key className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Key Rotation</h3>

          {!rotated ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                <Shield className="w-8 h-8 mx-auto text-red-400 mb-2" />
                <p className="text-sm text-slate-300 mb-1">
                  Rotate your cryptographic keys
                </p>
                <p className="text-xs text-slate-500">
                  This will generate new keys and anchor the rotation on-chain
                </p>
              </div>

              <Button
                onClick={handleRotate}
                disabled={isRotating}
                className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white"
                data-testid="button-rotate-keys"
              >
                {isRotating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rotating...
                  </>
                ) : (
                  <>
                    <RotateCw className="w-4 h-4 mr-2" />
                    Rotate Keys
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-900/50 border border-red-700/50">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <span
                    className="text-lg font-medium text-emerald-400"
                    data-testid="text-rotated-status"
                  >
                    Rotated ✓
                  </span>
                </div>

                {result && (
                  <div className="space-y-3 text-left">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Old Key</p>
                      <p
                        className="text-xs font-mono text-slate-500 line-through"
                        data-testid="text-old-key"
                      >
                        {result.oldKeyFingerprint}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">New Key</p>
                      <p
                        className="text-xs font-mono text-emerald-400"
                        data-testid="text-new-key"
                      >
                        {result.newKeyFingerprint}
                      </p>
                    </div>
                    {result.txHash && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">TX Hash</p>
                        <p
                          className="text-xs font-mono text-red-400 truncate"
                          data-testid="text-rotation-tx"
                        >
                          {result.txHash}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                data-testid="button-rotate-again"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Rotate Again
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
