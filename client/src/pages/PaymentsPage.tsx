import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import NotionLayout from "@/components/NotionLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnchorToggle from "@/components/AnchorToggle";
import AnchoredBadge from "@/components/AnchoredBadge";
import { Send, ArrowDownUp, Loader2, Check, X, AlertCircle, ExternalLink, Users, DollarSign, Clock, TrendingUp, FileText, CheckCircle, XCircle, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PaymentTransaction } from "@shared/schema";

type TxState = 'idle' | 'initiating' | 'awaiting_wallet' | 'broadcasting' | 'pending' | 'confirmed' | 'failed';

interface GasEstimate {
  gasEstimate: string;
  gasFee: string;
}

const ASSETS = [
  { value: "ETH", label: "Ethereum (ETH)", icon: "⟠" },
  { value: "USDC", label: "USD Coin (USDC)", icon: "💵" },
  { value: "USDT", label: "Tether (USDT)", icon: "💲" },
  { value: "DAI", label: "Dai (DAI)", icon: "◈" },
];

const CHAINS = [
  { value: "8453", label: "Base Mainnet", icon: "🔵" },
  { value: "84531", label: "Base Sepolia", icon: "🔵" },
  { value: "1", label: "Ethereum", icon: "⟠" },
];

const RECENT_CONTACTS = [
  { name: "alice.eth", address: "0x1234...5678", avatar: "👩" },
  { name: "bob.base.eth", address: "0x8765...4321", avatar: "👨" },
  { name: "charlie.eth", address: "0xabcd...efgh", avatar: "🧑" },
];

const SAVED_RECIPIENTS = [
  { name: "Treasury", address: "0x9999...1111", avatar: "🏦" },
  { name: "Savings", address: "0x2222...3333", avatar: "💰" },
];

function PaymentsPage() {
  const { toast } = useToast();
  
  const [fromAddress, _setFromAddress] = useState("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
  const [toAddress, setToAddress] = useState("");
  const [asset, setAsset] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [shouldAnchor, setShouldAnchor] = useState(true);
  const [selectedChain, setSelectedChain] = useState("8453");
  const [toEnsName, setToEnsName] = useState<string | null>(null);
  const [isResolvingEns, setIsResolvingEns] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentTransaction | null>(null);
  const [memo, setMemo] = useState("");
  const [txState, setTxState] = useState<TxState>('idle');
  const [currentTxHash, setCurrentTxHash] = useState<string | null>(null);

  const { data: gasEstimate, isLoading: isEstimating } = useQuery<GasEstimate>({
    queryKey: ['/api/payments/estimate', asset, amount],
    enabled: !!amount && parseFloat(amount) > 0,
  });

  const { data: payments = [], isLoading: isLoadingPayments } = useQuery<PaymentTransaction[]>({
    queryKey: ['/api/payments'],
    refetchInterval: 5000,
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: {
      fromAddress: string;
      toAddress: string;
      asset: string;
      amount: string;
      gasEstimate: string | null;
      gasFee: string | null;
      totalAmount: string;
      toEnsName: string | null;
      toBasename: string | null;
    }) => {
      return await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      toast({
        title: "Payment Sent",
        description: "Your payment has been successfully sent.",
      });
      setToAddress("");
      setAmount("");
      setToEnsName(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const resolveAddress = async () => {
      if (toAddress.endsWith(".eth") || toAddress.endsWith(".base.eth")) {
        setIsResolvingEns(true);
        setTimeout(() => {
          setToEnsName(toAddress);
          setIsResolvingEns(false);
        }, 800);
      } else {
        setToEnsName(null);
      }
    };

    if (toAddress) {
      resolveAddress();
    }
  }, [toAddress]);

  const total = amount && gasEstimate
    ? (parseFloat(amount) + parseFloat(gasEstimate.gasFee)).toFixed(8)
    : amount;

  const handleSend = async () => {
    if (!toAddress || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid recipient and amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      setTxState('initiating');
      setCurrentTxHash(null);

      setTxState('awaiting_wallet');
      await new Promise(resolve => setTimeout(resolve, 500));

      setTxState('broadcasting');

      createPaymentMutation.mutate({
        fromAddress,
        toAddress,
        asset,
        amount,
        gasEstimate: gasEstimate?.gasEstimate || null,
        gasFee: gasEstimate?.gasFee || null,
        totalAmount: total || amount,
        toEnsName,
        toBasename: toEnsName?.endsWith(".base.eth") ? toEnsName : null,
      }, {
        onSuccess: (data: any) => {
          setTxState('pending');
          if (data?.txHash) {
            setCurrentTxHash(data.txHash);
          }
          setTimeout(() => {
            setTxState('confirmed');
            setMemo("");
          }, 2000);
        },
        onError: () => {
          setTxState('failed');
        }
      });
    } catch (error) {
      setTxState('failed');
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const handleNumpadClick = (value: string) => {
    if (value === "clear") {
      setAmount("");
    } else if (value === "backspace") {
      setAmount(prev => prev.slice(0, -1));
    } else if (value === ".") {
      if (!amount.includes(".")) {
        setAmount(prev => prev + value);
      }
    } else {
      setAmount(prev => prev + value);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
      case "pending":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
      case "failed":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Check className="w-4 h-4" />;
      case "pending":
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case "failed":
        return <X className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const toolbar = (
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
          Payments
        </h1>
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
        <Select value={selectedChain} onValueChange={setSelectedChain}>
          <SelectTrigger className="w-48 h-9" data-testid="select-chain">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHAINS.map((chain) => (
              <SelectItem key={chain.value} value={chain.value}>
                <span className="flex items-center gap-2">
                  <span>{chain.icon}</span>
                  {chain.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <AnchorToggle
        checked={shouldAnchor}
        onChange={setShouldAnchor}
        label="Anchor to blockchain"
      />
    </div>
  );

  const sidebar = (
    <div className="p-4 space-y-6">
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Quick Actions
        </h2>
        <div className="space-y-2">
          <Button 
            className="w-full justify-start gap-3 h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-xl hover:shadow-purple-500/30" 
            data-testid="button-quick-send"
          >
            <Send className="w-4 h-4" />
            <span className="font-semibold">Send</span>
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-start gap-3 h-11 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all" 
            data-testid="button-quick-request"
          >
            <ArrowDownUp className="w-4 h-4" />
            <span className="font-semibold">Request</span>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Recent Contacts
        </h2>
        <div className="space-y-1.5">
          {RECENT_CONTACTS.map((contact) => (
            <button
              key={contact.address}
              onClick={() => setToAddress(contact.name)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
              data-testid={`button-contact-${contact.name}`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center text-lg">
                {contact.avatar}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {contact.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {contact.address}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Users className="w-3.5 h-3.5" />
          Saved Recipients
        </h2>
        <div className="space-y-1.5">
          {SAVED_RECIPIENTS.map((recipient) => (
            <button
              key={recipient.address}
              onClick={() => setToAddress(recipient.address)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
              data-testid={`button-recipient-${recipient.name}`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center text-lg">
                {recipient.avatar}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {recipient.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {recipient.address}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const editor = (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6 sm:space-y-8 pb-24 md:pb-8">
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Send Payment
        </h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Send crypto with premium security
        </p>
      </div>

      <div className="space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <Label htmlFor="asset" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Select Asset
          </Label>
          <Select value={asset} onValueChange={setAsset}>
            <SelectTrigger 
              id="asset" 
              data-testid="select-asset" 
              className="w-full h-12 sm:h-14 text-base bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 transition-all"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSETS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  <span className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                    <span className="text-xl sm:text-2xl">{a.icon}</span>
                    <span className="font-semibold">{a.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Amount
          </Label>
          <div className="relative">
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-3xl sm:text-5xl font-bold h-16 sm:h-24 text-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-2 border-purple-200 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600 transition-all shadow-inner"
              data-testid="input-amount"
            />
            <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-lg sm:text-2xl font-bold text-slate-400 dark:text-slate-500">
              {asset}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map((num) => (
              <Button
                key={num}
                variant="outline"
                onClick={() => handleNumpadClick(num === "⌫" ? "backspace" : num)}
                className="h-11 sm:h-14 text-lg sm:text-xl font-bold bg-white dark:bg-slate-900 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all active:scale-95"
                data-testid={`button-numpad-${num}`}
              >
                {num}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="recipient" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Recipient
          </Label>
          <div className="relative">
            <Input
              id="recipient"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x... or name.eth"
              className="h-14 text-base pr-12 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-purple-400 dark:focus:border-purple-600 transition-all"
              data-testid="input-recipient"
            />
            {isResolvingEns && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-purple-600 dark:text-purple-400" />
            )}
            {toEnsName && !isResolvingEns && (
              <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          {toEnsName && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                Resolved: {toEnsName}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-600 dark:text-slate-400">Memo (optional)</label>
          <Input
            placeholder="Add a note for this payment..."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="glass-card"
            data-testid="input-payment-memo"
          />
        </div>

        {txState !== 'idle' && (
          <div className="glass-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              {txState === 'confirmed' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : 
               txState === 'failed' ? <XCircle className="w-5 h-5 text-red-500" /> :
               <Radio className="w-5 h-5 text-purple-500 animate-pulse" />}
              <span className="text-sm font-medium capitalize">{txState.replace('_', ' ')}</span>
            </div>
            {currentTxHash && (
              <Link href={`/explorer?txHash=${currentTxHash}`}>
                <span className="text-xs text-purple-600 hover:underline">View in Explorer</span>
              </Link>
            )}
          </div>
        )}

        {amount && parseFloat(amount) > 0 && (
          <div className="p-6 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border-2 border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Gas Estimation
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Amount</span>
                <span className="font-bold text-base">{amount} {asset}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">Network Fee</span>
                <span className="font-semibold">
                  {isEstimating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    gasEstimate ? `${gasEstimate.gasFee} ETH` : "—"
                  )}
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
              <div className="flex justify-between items-center">
                <span className="font-bold text-base">Total</span>
                <span className="font-bold text-xl text-purple-600 dark:text-purple-400">
                  {total} {asset}
                </span>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={createPaymentMutation.isPending || !toAddress || !amount}
          className="w-full h-16 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/40 transition-all active:scale-[0.98]"
          data-testid="button-send"
        >
          {createPaymentMutation.isPending ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin mr-3" />
              Sending Payment...
            </>
          ) : (
            <>
              <Send className="w-6 h-6 mr-3" />
              Send {amount || "0.00"} {asset}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const properties = (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-3.5 h-3.5" />
          Activity Feed
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {payments.length} transaction{payments.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
        {isLoadingPayments ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <DollarSign className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">No transactions yet</p>
          </div>
        ) : (
          payments.map((payment) => (
            <button
              key={payment.id}
              onClick={() => setSelectedPayment(payment)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                selectedPayment?.id === payment.id
                  ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-800'
              }`}
              data-testid={`activity-${payment.id}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${getStatusColor(payment.status)}`}>
                  {getStatusIcon(payment.status)}
                  {payment.status}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(payment.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mb-3">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {payment.amount} {payment.asset}
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="font-semibold">To:</span>
                  <span className="font-mono">
                    {payment.toEnsName || `${payment.toAddress.slice(0, 6)}...${payment.toAddress.slice(-4)}`}
                  </span>
                </div>
                {payment.anchorStatus === "confirmed" && payment.anchorTxHash && (
                  <div className="pt-1">
                    <AnchoredBadge
                      txHash={payment.anchorTxHash}
                      chainId={parseInt(payment.chainId)}
                      size="sm"
                    />
                  </div>
                )}
                {(payment as any).proofCid && (
                  <div className="pt-1">
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${(payment as any).proofCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      data-testid={`link-ipfs-proof-${payment.id}`}
                    >
                      <FileText className="w-3 h-3" />
                      IPFS Proof
                    </a>
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {selectedPayment && (
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border-2 border-slate-200 dark:border-slate-700 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Transaction Details</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Amount</span>
              <span className="font-bold">{selectedPayment.amount} {selectedPayment.asset}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">From</span>
              <span className="font-mono text-xs">{selectedPayment.fromAddress.slice(0, 10)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">To</span>
              <span className="font-mono text-xs">{selectedPayment.toAddress.slice(0, 10)}...</span>
            </div>
            {selectedPayment.gasFee && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Gas Fee</span>
                <span className="font-semibold">{selectedPayment.gasFee} ETH</span>
              </div>
            )}
            {selectedPayment.txHash && (
              <div className="pt-2">
                <a
                  href={`https://basescan.org/tx/${selectedPayment.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5 font-semibold"
                  data-testid={`link-tx-${selectedPayment.id}`}
                >
                  View on Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <NotionLayout
      toolbar={toolbar}
      sidebar={sidebar}
      editor={editor}
      properties={properties}
      sidebarWidth="280px"
      propertiesWidth="340px"
    />
  );
}

export default PaymentsPage;
