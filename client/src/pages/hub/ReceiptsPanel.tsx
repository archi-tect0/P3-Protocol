import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FileCheck,
  Shield,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  Search,
  Loader2,
  RefreshCw,
  Clock,
  Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SDK } from '@/lib/sdk';
import type { Receipt } from '@/lib/sdk/modules/receipts';

export default function ReceiptsPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyProof, setVerifyProof] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message?: string } | null>(null);

  const { data: receiptsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/nexus/receipts'],
    queryFn: () => SDK.receipts.list(),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ receiptId, proof }: { receiptId: string; proof: string }) =>
      SDK.receipts.verify({ receiptId, proof }),
    onSuccess: (result) => {
      setVerifyResult({ valid: result.valid, message: result.error });
      if (result.valid) {
        toast({ title: 'Proof verified', description: 'The receipt proof is valid.' });
      } else {
        toast({ variant: 'destructive', title: 'Invalid proof', description: result.error });
      }
    },
    onError: () => {
      setVerifyResult({ valid: false, message: 'Verification failed' });
      toast({ variant: 'destructive', title: 'Verification failed' });
    },
  });

  const receipts = receiptsData?.receipts || [];

  const filteredReceipts = receipts.filter(
    (receipt) =>
      receipt.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.hash.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const handleVerify = () => {
    if (!selectedReceipt || !verifyProof.trim()) {
      toast({ variant: 'destructive', title: 'Enter a proof to verify' });
      return;
    }
    verifyMutation.mutate({ receiptId: selectedReceipt.id, proof: verifyProof });
  };

  const getReceiptTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'payment':
        return 'from-green-500 to-emerald-600';
      case 'message':
        return 'from-blue-500 to-indigo-600';
      case 'meeting':
        return 'from-purple-500 to-violet-600';
      default:
        return 'from-slate-500 to-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-transparent to-purple-900/10 pointer-events-none" />

      <div className="relative z-10 h-screen flex">
        <div className="w-80 border-r border-white/5 flex flex-col bg-[#1a1a1a]/40">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <Button
                data-testid="button-back-hub"
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/launcher')}
                className="text-slate-400 hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold text-white">Receipts</h1>
              <Button
                data-testid="button-refresh-receipts"
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="ml-auto text-slate-400 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                data-testid="input-search-receipts"
                placeholder="Search receipts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#252525] border-white/5 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Loading receipts...</p>
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="p-8 text-center">
                <FileCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No receipts yet</p>
                <p className="text-xs text-slate-600 mt-1">Your proofs will appear here</p>
              </div>
            ) : (
              filteredReceipts.map((receipt) => (
                <button
                  key={receipt.id}
                  data-testid={`button-receipt-${receipt.id}`}
                  onClick={() => {
                    setSelectedReceipt(receipt);
                    setVerifyResult(null);
                    setVerifyProof('');
                  }}
                  className={`w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 ${
                    selectedReceipt?.id === receipt.id ? 'bg-violet-600/10 border-l-2 border-l-violet-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getReceiptTypeColor(receipt.type)} flex items-center justify-center`}>
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white capitalize">{receipt.type}</p>
                        {receipt.anchored && (
                          <ShieldCheck className="w-3 h-3 text-green-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate font-mono mt-1">
                        {receipt.hash.slice(0, 16)}...
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2">
                    {new Date(receipt.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedReceipt ? (
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getReceiptTypeColor(selectedReceipt.type)} flex items-center justify-center`}>
                      <Shield className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white capitalize">
                        {selectedReceipt.type} Receipt
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">ID: {selectedReceipt.id}</p>
                    </div>
                  </div>
                  <Badge
                    className={
                      selectedReceipt.anchored
                        ? 'bg-green-500/20 text-green-300 border-0'
                        : 'bg-yellow-500/20 text-yellow-300 border-0'
                    }
                  >
                    {selectedReceipt.anchored ? (
                      <>
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Anchored
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </>
                    )}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-6">
                  <Card className="bg-[#1a1a1a]/80 border-white/5 p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Receipt Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Hash</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-white font-mono">
                            {selectedReceipt.hash.slice(0, 20)}...{selectedReceipt.hash.slice(-8)}
                          </code>
                          <Button
                            data-testid="button-copy-hash"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedReceipt.hash, 'Hash')}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Owner</span>
                        <code className="text-xs text-white font-mono">
                          {selectedReceipt.owner.slice(0, 8)}...{selectedReceipt.owner.slice(-6)}
                        </code>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Created</span>
                        <span className="text-xs text-white">
                          {new Date(selectedReceipt.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {selectedReceipt.txHash && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Transaction</span>
                          <a
                            href={`https://basescan.org/tx/${selectedReceipt.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                          >
                            {selectedReceipt.txHash.slice(0, 12)}...
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      {selectedReceipt.blockNumber && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Block</span>
                          <span className="text-xs text-white font-mono">
                            #{selectedReceipt.blockNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="bg-[#1a1a1a]/80 border-white/5 p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Verify Proof</h3>
                    <div className="space-y-3">
                      <Input
                        data-testid="input-verify-proof"
                        placeholder="Enter proof string..."
                        value={verifyProof}
                        onChange={(e) => setVerifyProof(e.target.value)}
                        className="bg-[#252525] border-white/5 text-white font-mono text-sm"
                      />
                      <Button
                        data-testid="button-verify-proof"
                        onClick={handleVerify}
                        disabled={verifyMutation.isPending || !verifyProof.trim()}
                        className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                      >
                        {verifyMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Shield className="w-4 h-4 mr-2" />
                        )}
                        Verify Proof
                      </Button>

                      {verifyResult && (
                        <div
                          className={`p-3 rounded-lg flex items-center gap-3 ${
                            verifyResult.valid
                              ? 'bg-green-500/10 border border-green-500/20'
                              : 'bg-red-500/10 border border-red-500/20'
                          }`}
                        >
                          {verifyResult.valid ? (
                            <ShieldCheck className="w-5 h-5 text-green-400" />
                          ) : (
                            <ShieldX className="w-5 h-5 text-red-400" />
                          )}
                          <div>
                            <p className={`text-sm font-medium ${verifyResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                              {verifyResult.valid ? 'Valid Proof' : 'Invalid Proof'}
                            </p>
                            {verifyResult.message && (
                              <p className="text-xs text-slate-400 mt-1">{verifyResult.message}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {selectedReceipt.data && Object.keys(selectedReceipt.data).length > 0 && (
                    <Card className="bg-[#1a1a1a]/80 border-white/5 p-4">
                      <h3 className="text-sm font-medium text-slate-400 mb-3">Additional Data</h3>
                      <pre className="text-xs text-white font-mono bg-[#252525] p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(selectedReceipt.data, null, 2)}
                      </pre>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#252525] flex items-center justify-center mx-auto mb-4">
                  <FileCheck className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Select a receipt</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Choose a receipt from the sidebar to view details and verify proofs.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
