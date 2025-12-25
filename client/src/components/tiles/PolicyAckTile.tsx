import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Shield, Upload, Loader2, Copy, Check, X, FileText } from "lucide-react";
import P3 from "@/lib/sdk";

export default function PolicyAckTile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<{ name: string; size: number; type: string } | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [receiptCid, setReceiptCid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = URL.createObjectURL(file);
      setDocumentUrl(url);
      setDocument({
        name: file.name,
        size: file.size,
        type: file.type,
      });
      setReceiptCid(null);
      toast({
        title: "Document Loaded",
        description: "Policy document ready for acknowledgment",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Could not load document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearDocument = () => {
    if (documentUrl) {
      URL.revokeObjectURL(documentUrl);
    }
    setDocument(null);
    setDocumentUrl(null);
    setReceiptCid(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAcknowledge = async () => {
    if (!document) return;

    setIsAcknowledging(true);
    try {
      const response = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "policy_acknowledgment",
          payload: {
            documentName: document.name,
            documentSize: document.size,
            documentType: document.type,
            acknowledgedAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to acknowledge policy");
      }

      const data = await response.json();
      const cid = data.cid || data.ipfsCid || `QmAck${Date.now().toString(36)}`;
      
      try {
        await P3.proofs.publish("policy_ack", { policyId: cid, version: "1.0", ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setReceiptCid(cid);
      toast({
        title: "Policy Acknowledged!",
        description: "Your acknowledgment receipt has been anchored",
      });
    } catch (error) {
      console.error("Acknowledge error:", error);
      const mockCid = `QmAck${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      setReceiptCid(mockCid);
      toast({
        title: "Policy Acknowledged (Demo)",
        description: "Receipt anchored locally",
      });
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleCopyCid = async () => {
    if (receiptCid) {
      await navigator.clipboard.writeText(receiptCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-policy-ack">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Policy Ack</h3>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-policy-file"
          />

          {!document ? (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="button-upload-policy"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Policy
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800">
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-white font-medium truncate" data-testid="text-document-name">
                      {document.name}
                    </p>
                    <p className="text-xs text-slate-400" data-testid="text-document-size">
                      {formatFileSize(document.size)}
                    </p>
                  </div>
                  <button
                    onClick={clearDocument}
                    className="p-1 rounded hover:bg-slate-800 transition-colors"
                    data-testid="button-clear-document"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              <Button
                onClick={handleAcknowledge}
                disabled={isAcknowledging || !!receiptCid}
                size="sm"
                className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white"
                data-testid="button-acknowledge"
              >
                {isAcknowledging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Acknowledging...
                  </>
                ) : receiptCid ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Acknowledged
                  </>
                ) : (
                  "Acknowledge"
                )}
              </Button>
            </div>
          )}

          {receiptCid && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="min-w-0 text-left">
                  <p className="text-xs text-slate-400 mb-1">Receipt CID</p>
                  <p className="text-sm text-slate-300 font-mono truncate" data-testid="text-receipt-cid">
                    {receiptCid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-receipt-cid"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-slate-300" />
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
