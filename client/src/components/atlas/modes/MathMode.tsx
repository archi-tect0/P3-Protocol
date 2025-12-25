import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Calculator, RefreshCw, Loader2, Send, Copy, Check,
  History, Rocket, Sigma, FunctionSquare, Hash, ChevronDown, ChevronUp,
  Clock, Zap, Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type MathEngine = 'symbolic' | 'numeric' | 'hybrid';
type MathProvider = 'openai' | 'anthropic' | 'gemini' | 'local';

interface MathOutput {
  value: string;
  unit?: string;
}

interface MathStep {
  step: number;
  description: string;
  result: string;
}

interface MathIntent {
  type: string;
  inputs: Record<string, any>;
  operation: string;
}

interface MathComputation {
  id: string;
  intentType: string;
  query: string;
  outputs: Record<string, MathOutput>;
  engine: MathEngine;
  provider: MathProvider | null;
  latencyMs: number | null;
  createdAt: string;
}

interface ComputeResult {
  computation: {
    id: string;
    intent: MathIntent;
    equations: string[];
    steps: MathStep[];
    outputs: Record<string, MathOutput>;
    explanation?: string;
  };
  meta: {
    engine: MathEngine;
    provider: MathProvider | null;
    latencyMs: number;
    tokenUsage?: { input: number; output: number; total: number };
  };
  receipt: {
    hash: string;
    wallet: string;
    timestamp: string;
  };
}

interface HistoryResponse {
  computations: MathComputation[];
  count: number;
}

const INTENT_ICONS: Record<string, any> = {
  orbital: Rocket,
  calculus: Sigma,
  algebra: FunctionSquare,
  arithmetic: Calculator,
  trigonometry: Hash,
  statistics: Hash,
  linear_algebra: Hash,
  conversion: Hash,
  general: Brain,
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function MathMode() {
  const wallet = useAtlasStore(s => s.wallet);
  const pushReceipt = useAtlasStore(s => s.pushReceipt);
  const { toast } = useToast();
  
  const [query, setQuery] = useState('');
  const [engine, setEngine] = useState<MathEngine>('hybrid');
  const [provider, setProvider] = useState<MathProvider>('anthropic');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<ComputeResult | null>(null);

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery<HistoryResponse>({
    queryKey: ['/api/atlas/math/history', wallet],
    enabled: !!wallet && showHistory,
  });

  const compute = useMutation({
    mutationFn: async (params: { query: string; engine: MathEngine; provider?: MathProvider }) => {
      const response = await apiRequest('/api/atlas/math/compute', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return response as ComputeResult;
    },
    onSuccess: (data) => {
      setCurrentResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/math/history'] });
      toast({ title: 'Computation complete' });
      pushReceipt({
        id: `receipt-math-${data.computation.id}`,
        hash: data.receipt.hash,
        scope: `atlas.math.${data.computation.intent.type}`,
        endpoint: '/api/atlas/math/compute',
        timestamp: Date.now(),
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Computation failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    compute.mutate({ query, engine, provider });
  };

  const copyResult = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="math-no-wallet">
        <Calculator className="w-12 h-12 text-white/30" />
        <p className="text-white/60 text-center">Connect wallet to use Math Engine</p>
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="math-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400/20 to-pink-400/20">
            <Calculator className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-math-title">
            Math Engine
          </h2>
          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-400/20 text-purple-400">
            OS-Native
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="text-white/60 hover:text-white"
          data-testid="button-toggle-history"
        >
          <History className="w-4 h-4 mr-1.5" />
          History
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 space-y-4" data-testid="math-form">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter math query... (e.g., 'calculate delta-v for Mars transfer orbit')"
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40"
            disabled={compute.isPending}
            data-testid="input-math-query"
          />
          <Button
            type="submit"
            disabled={compute.isPending || !query.trim()}
            className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400"
            data-testid="button-compute"
          >
            {compute.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Engine:</span>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as MathEngine)}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/70"
              data-testid="select-engine"
            >
              <option value="hybrid">Hybrid</option>
              <option value="symbolic">Symbolic (AI)</option>
              <option value="numeric">Numeric (Local)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Provider:</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as MathProvider)}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/70"
              data-testid="select-provider"
            >
              <option value="anthropic">Claude</option>
              <option value="openai">GPT-4</option>
              <option value="gemini">Gemini</option>
              <option value="local">Local</option>
            </select>
          </div>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {currentResult && (
          <MotionDiv
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <MathCard
              result={currentResult}
              expanded={expandedSteps[currentResult.computation.id] || false}
              onToggleExpand={() => setExpandedSteps(prev => ({
                ...prev,
                [currentResult.computation.id]: !prev[currentResult.computation.id]
              }))}
              copiedId={copiedId}
              onCopy={copyResult}
            />
          </MotionDiv>
        )}
      </AnimatePresence>

      {showHistory && (
        <MotionDiv
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/60">Computation History</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchHistory()}
              className="text-white/40 hover:text-white p-1"
              data-testid="button-refresh-history"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : historyData?.computations.length === 0 ? (
            <div className="text-center py-8" data-testid="history-empty">
              <Calculator className="w-12 h-12 text-white/20 mx-auto mb-2" />
              <p className="text-white/40 text-sm">No computations yet</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="history-list">
              {historyData?.computations.map((comp) => {
                const Icon = INTENT_ICONS[comp.intentType] || Calculator;
                return (
                  <MotionDiv
                    key={comp.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                    data-testid={`history-item-${comp.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded bg-purple-400/20">
                          <Icon className="w-3 h-3 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/70 line-clamp-1">{comp.query}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-white/40">{comp.intentType}</span>
                            {comp.latencyMs && (
                              <span className="text-xs text-white/30 flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5" />
                                {comp.latencyMs}ms
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-white/30">{formatTimeAgo(comp.createdAt)}</span>
                    </div>
                  </MotionDiv>
                );
              })}
            </div>
          )}
        </MotionDiv>
      )}

      {!currentResult && !showHistory && (
        <div className="text-center py-12" data-testid="math-empty">
          <Calculator className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 mb-2">Enter a math query to begin</p>
          <p className="text-white/40 text-sm max-w-md mx-auto">
            From basic arithmetic to orbital mechanics, Atlas Math Engine handles it all with AI-powered symbolic reasoning and precision numeric computation.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {['2 + 2 * 3', 'derivative of x^2', 'delta-v Mars orbit'].map(example => (
              <button
                key={example}
                onClick={() => setQuery(example)}
                className="px-3 py-1.5 text-xs rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                data-testid={`button-example-${example.replace(/\s+/g, '-')}`}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </MotionDiv>
  );
}

function MathCard({
  result,
  expanded,
  onToggleExpand,
  copiedId,
  onCopy,
}: {
  result: ComputeResult;
  expanded: boolean;
  onToggleExpand: () => void;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const { computation, meta, receipt } = result;
  const Icon = INTENT_ICONS[computation.intent.type] || Calculator;

  return (
    <div 
      className="rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-400/20 overflow-hidden"
      data-testid={`math-card-${computation.id}`}
    >
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-400/20">
              <Icon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/80">{computation.intent.type}</h3>
              <p className="text-xs text-white/40">{computation.intent.operation}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {meta.latencyMs}ms
            </span>
            {meta.provider && (
              <span className="px-1.5 py-0.5 rounded bg-white/10">{meta.provider}</span>
            )}
          </div>
        </div>

        {Object.keys(computation.outputs).length > 0 && (
          <div className="grid gap-2">
            {Object.entries(computation.outputs).map(([key, output]) => (
              <div 
                key={key}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5"
              >
                <div>
                  <span className="text-xs text-white/40 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <p className="text-lg font-mono text-white/90" data-testid={`text-output-${key}`}>
                    {output.value} {output.unit && <span className="text-sm text-white/60">{output.unit}</span>}
                  </p>
                </div>
                <button
                  onClick={() => onCopy(`${output.value} ${output.unit || ''}`.trim(), `${computation.id}-${key}`)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  data-testid={`button-copy-${key}`}
                >
                  {copiedId === `${computation.id}-${key}` ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/40" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {computation.equations.length > 0 && (
        <div className="p-4 border-b border-white/10 bg-black/20">
          <h4 className="text-xs text-white/40 uppercase mb-2">Equations</h4>
          <div className="space-y-1">
            {computation.equations.map((eq, i) => (
              <code key={i} className="block text-sm font-mono text-purple-300/80">{eq}</code>
            ))}
          </div>
        </div>
      )}

      {computation.steps.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors w-full"
            data-testid="button-toggle-steps"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {computation.steps.length} steps
          </button>
          <AnimatePresence>
            {expanded && (
              <MotionDiv
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-2"
              >
                {computation.steps.map((step) => (
                  <div key={step.step} className="flex gap-3 text-sm">
                    <span className="text-white/30 font-mono">{step.step}.</span>
                    <div>
                      <p className="text-white/60">{step.description}</p>
                      {step.result && <p className="text-purple-300/80 font-mono text-xs mt-0.5">{step.result}</p>}
                    </div>
                  </div>
                ))}
              </MotionDiv>
            )}
          </AnimatePresence>
        </div>
      )}

      {computation.explanation && (
        <div className="p-4 bg-black/20">
          <p className="text-sm text-white/60">{computation.explanation}</p>
        </div>
      )}

      <div className="px-4 py-2 bg-black/30 flex items-center justify-between text-xs text-white/30">
        <span className="font-mono truncate max-w-[200px]">{receipt.hash.slice(0, 18)}...</span>
        <span>{new Date(receipt.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
