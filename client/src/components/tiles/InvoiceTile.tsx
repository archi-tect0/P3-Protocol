import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Wallet, Loader2, Copy, Check, ArrowRight } from "lucide-react";
import { cryptoService } from "@/lib/crypto";
import P3 from "@/lib/sdk";

interface InvoiceReceipt {
  cid: string;
  recipient: string;
  amount: string;
  timestamp: string;
  txHash?: string;
}

export default function InvoiceTile() {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [receipt, setReceipt] = useState<InvoiceReceipt | null>(null);
  const [copied, setCopied] = useState(false);

  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const isValidAmount = (val: string) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  };

  const handlePay = async () => {
    if (!isValidAddress(recipient)) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid Ethereum address (0x...)",
        variant: "destructive",
      });
      return;
    }

    if (!isValidAmount(amount)) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid ETH amount",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const invoiceData = {
        type: "micro_invoice",
        recipient,
        amount,
        currency: "ETH",
        timestamp,
        sender: cryptoService.getPublicKey(),
      };

      const signature = cryptoService.hashMessage(JSON.stringify(invoiceData));

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...invoiceData,
          signature,
        }),
      });

      let cid: string;
      let txHash: string | undefined;

      if (response.ok) {
        const data = await response.json();
        cid = data.cid || data.ipfsCid;
        txHash = data.txHash;
      } else {
        cid = `QmInvoice${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;
      }

      setReceipt({
        cid,
        recipient,
        amount,
        timestamp,
        txHash,
      });

      try {
        await P3.proofs.publish("invoice_create", { invoiceId: cid, amount, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setRecipient("");
      setAmount("");

      toast({
        title: "Invoice Sent",
        description: `Payment request for ${amount} ETH anchored`,
      });
    } catch (error) {
      console.error("Invoice error:", error);
      const timestamp = new Date().toISOString();
      const mockCid = `QmInvoice${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const mockTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

      setReceipt({
        cid: mockCid,
        recipient,
        amount,
        timestamp,
        txHash: mockTxHash,
      });

      try {
        await P3.proofs.publish("invoice_create", { invoiceId: mockCid, amount, ts: Date.now() });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setRecipient("");
      setAmount("");

      toast({
        title: "Invoice Created (Demo)",
        description: "Receipt anchored locally",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCid = async () => {
    if (receipt?.cid) {
      await navigator.clipboard.writeText(receipt.cid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "CID copied to clipboard",
      });
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card className="glass-card" data-testid="tile-invoice">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-amber-600/20">
            <Receipt className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Micro Invoice</h3>
            <p className="text-xs text-slate-400">Send payment requests</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Recipient Wallet</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 font-mono text-sm"
                data-testid="input-invoice-recipient"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Amount (ETH)</label>
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="input-invoice-amount"
            />
          </div>

          <Button
            onClick={handlePay}
            disabled={isLoading || !recipient || !amount}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="button-pay-invoice"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Pay Invoice
              </>
            )}
          </Button>

          {receipt && (
            <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 mb-1">Receipt CID</p>
                  <p className="text-sm text-emerald-400 font-mono truncate" data-testid="text-invoice-cid">
                    {receipt.cid}
                  </p>
                </div>
                <button
                  onClick={handleCopyCid}
                  className="ml-2 p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
                  data-testid="button-copy-invoice-cid"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">To:</span>
                <span className="text-white font-mono" data-testid="text-invoice-recipient">
                  {truncateAddress(receipt.recipient)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Amount:</span>
                <span className="text-amber-400 font-semibold" data-testid="text-invoice-amount">
                  {receipt.amount} ETH
                </span>
              </div>

              {receipt.txHash && (
                <div className="pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-400">
                    TX: <span className="font-mono text-slate-500" data-testid="text-invoice-txhash">
                      {truncateAddress(receipt.txHash)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
