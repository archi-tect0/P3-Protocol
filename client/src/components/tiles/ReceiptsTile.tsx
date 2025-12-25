import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Loader2, Copy, Check, FileText } from "lucide-react";
import P3 from "@/lib/sdk";

interface ReceiptItem {
  id: string;
  type: string;
  cid: string;
  timestamp: string;
}

export default function ReceiptsTile() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleLoadReceipts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/receipts");
      let fetchedReceipts: ReceiptItem[] = [];
      
      if (response.ok) {
        const data = await response.json();
        fetchedReceipts = data.receipts || [];
        setReceipts(fetchedReceipts);
      } else {
        throw new Error("Failed to fetch receipts");
      }

      try {
        await P3.proofs.publish("receipts_view", { count: fetchedReceipts.length, ts: Date.now() });
      } catch (e) { console.warn("Anchor failed:", e); }

      toast({
        title: "Receipts Loaded",
        description: "Anchored receipts have been fetched",
      });
    } catch (error) {
      console.error("Receipts error:", error);
      const mockReceipts: ReceiptItem[] = [
        {
          id: "1",
          type: "payment",
          cid: `QmPay${Date.now().toString(36).slice(0, 6)}`,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: "2",
          type: "message",
          cid: `QmMsg${Date.now().toString(36).slice(0, 6)}`,
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: "3",
          type: "meeting",
          cid: `QmMeet${Date.now().toString(36).slice(0, 6)}`,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
      setReceipts(mockReceipts);

      try {
        await P3.proofs.publish("receipts_view", { count: mockReceipts.length, ts: Date.now() });
      } catch (e) { console.warn("Anchor failed:", e); }

      toast({
        title: "Receipts Loaded (Demo)",
        description: "Showing sample receipt data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCid = async (receipt: ReceiptItem) => {
    await navigator.clipboard.writeText(receipt.cid);
    setCopiedId(receipt.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copied",
      description: "CID copied to clipboard",
    });
  };

  const formatTimestamp = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "payment":
        return "💰";
      case "message":
        return "💬";
      case "meeting":
        return "📅";
      default:
        return "📄";
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-receipts">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-slate-600/20">
            <Receipt className="w-6 h-6 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Receipts</h3>
            <p className="text-xs text-slate-400">Browse anchored receipts</p>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleLoadReceipts}
            disabled={isLoading}
            className="w-full bg-slate-600 hover:bg-slate-700 text-white"
            data-testid="button-load-receipts"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Load
              </>
            )}
          </Button>

          {receipts.length > 0 && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="p-3 rounded-lg bg-slate-900/50 border border-slate-700"
                  data-testid={`receipt-item-${receipt.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getTypeIcon(receipt.type)}</span>
                      <span className="text-sm font-medium text-white capitalize" data-testid={`text-receipt-type-${receipt.id}`}>
                        {receipt.type}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyCid(receipt)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      data-testid={`button-copy-receipt-${receipt.id}`}
                    >
                      {copiedId === receipt.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-emerald-400 font-mono truncate" data-testid={`text-receipt-cid-${receipt.id}`}>
                    {receipt.cid}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatTimestamp(receipt.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {receipts.length === 0 && !isLoading && (
            <div className="text-center py-4 text-slate-500 text-sm">
              Click Load to fetch your receipts
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
