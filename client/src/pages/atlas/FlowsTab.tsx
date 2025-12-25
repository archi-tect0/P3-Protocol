import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Play, 
  Trash2, 
  Loader2,
  Check,
  AlertCircle,
  Clock
} from 'lucide-react';

interface Session {
  wallet: string;
  grants: string[];
  roles: string[];
  expiresAt: number;
}

interface FlowStep {
  id: string;
  key: string;
  args: Record<string, any>;
}

interface Receipt {
  step: string;
  status: 'ok' | 'error' | 'held_for_review';
  digest?: string;
  ts: number;
  error?: string;
}

const AVAILABLE_ENDPOINTS = [
  { key: 'messages.compose', label: 'Send Message', scopes: ['messages'] },
  { key: 'messages.list', label: 'List Messages', scopes: ['messages'] },
  { key: 'notes.create', label: 'Create Note', scopes: ['storage'] },
  { key: 'payments.send', label: 'Send Payment', scopes: ['payments'] },
  { key: 'anchors.create', label: 'Create Anchor', scopes: ['anchors'] },
  { key: 'dao.vote', label: 'Cast Vote', scopes: ['dao'] },
];

export default function FlowsTab({ session }: { session: Session }) {
  const { toast } = useToast();
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [running, setRunning] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [showEndpoints, setShowEndpoints] = useState(false);

  function addStep(endpoint: typeof AVAILABLE_ENDPOINTS[0]) {
    const newStep: FlowStep = {
      id: `step-${Date.now()}`,
      key: endpoint.key,
      args: {},
    };
    setSteps(prev => [...prev, newStep]);
    setShowEndpoints(false);
  }

  function removeStep(id: string) {
    setSteps(prev => prev.filter(s => s.id !== id));
  }

  function updateStepArg(stepId: string, argKey: string, value: string) {
    setSteps(prev => prev.map(s => 
      s.id === stepId 
        ? { ...s, args: { ...s.args, [argKey]: value } }
        : s
    ));
  }

  async function runFlow() {
    if (steps.length === 0) {
      toast({ title: 'Add steps first', variant: 'destructive' });
      return;
    }

    setRunning(true);
    setReceipts([]);

    try {
      const response = await fetch('/api/atlas/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoints: steps.map(s => ({ key: s.key, args: s.args })),
          session,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setReceipts(data.receipts || []);
        const successCount = data.receipts?.filter((r: Receipt) => r.status === 'ok').length || 0;
        toast({ 
          title: 'Flow completed', 
          description: `${successCount}/${steps.length} steps succeeded` 
        });
      } else {
        toast({ title: 'Flow failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      console.error('Flow execution failed:', err);
      toast({ title: 'Flow failed', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }

  function getReceiptForStep(stepKey: string): Receipt | undefined {
    return receipts.find(r => r.step === stepKey);
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Flow Builder</h2>
        <div className="flex gap-2">
          <Button
            data-testid="button-add-step"
            variant="outline"
            size="sm"
            onClick={() => setShowEndpoints(!showEndpoints)}
            className="border-white/10 text-slate-300 hover:bg-white/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Step
          </Button>
          <Button
            data-testid="button-run-flow"
            size="sm"
            onClick={runFlow}
            disabled={running || steps.length === 0}
            className="bg-purple-600 hover:bg-purple-500"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>

      {showEndpoints && (
        <div className="glass-panel rounded-xl p-3 mb-4 space-y-2">
          <p className="text-xs text-slate-400 mb-2">Select an endpoint to add:</p>
          {AVAILABLE_ENDPOINTS.map(ep => (
            <button
              key={ep.key}
              data-testid={`add-endpoint-${ep.key}`}
              onClick={() => addStep(ep)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <span className="text-sm text-slate-300">{ep.label}</span>
              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                {ep.key}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">No steps yet</p>
            <p className="text-slate-500 text-xs">Click "Add Step" to build your flow</p>
          </div>
        ) : (
          steps.map((step, index) => {
            const receipt = getReceiptForStep(step.key);
            return (
              <div
                key={step.id}
                data-testid={`flow-step-${index}`}
                className="glass-panel rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="flex-1 font-medium text-white">{step.key}</span>
                  {receipt && (
                    <div className="flex items-center gap-1">
                      {receipt.status === 'ok' && <Check className="w-4 h-4 text-emerald-400" />}
                      {receipt.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                      {receipt.status === 'held_for_review' && <Clock className="w-4 h-4 text-amber-400" />}
                    </div>
                  )}
                  <Button
                    data-testid={`remove-step-${index}`}
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStep(step.id)}
                    className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {step.key === 'messages.compose' && (
                    <>
                      <Input
                        placeholder="Recipient address (0x...)"
                        value={step.args.to || ''}
                        onChange={(e) => updateStepArg(step.id, 'to', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                      <Input
                        placeholder="Message body"
                        value={step.args.body || ''}
                        onChange={(e) => updateStepArg(step.id, 'body', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </>
                  )}
                  {step.key === 'payments.send' && (
                    <>
                      <Input
                        placeholder="Recipient address (0x...)"
                        value={step.args.to || ''}
                        onChange={(e) => updateStepArg(step.id, 'to', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                      <Input
                        placeholder="Amount"
                        value={step.args.amount || ''}
                        onChange={(e) => updateStepArg(step.id, 'amount', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </>
                  )}
                  {step.key === 'dao.vote' && (
                    <>
                      <Input
                        placeholder="Proposal ID"
                        value={step.args.proposalId || ''}
                        onChange={(e) => updateStepArg(step.id, 'proposalId', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </>
                  )}
                  {step.key === 'notes.create' && (
                    <>
                      <Input
                        placeholder="Note title"
                        value={step.args.title || ''}
                        onChange={(e) => updateStepArg(step.id, 'title', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                      <Input
                        placeholder="Note body"
                        value={step.args.body || ''}
                        onChange={(e) => updateStepArg(step.id, 'body', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </>
                  )}
                </div>

                {receipt?.error && (
                  <p className="mt-2 text-xs text-red-400">{receipt.error}</p>
                )}
                {receipt?.digest && (
                  <p className="mt-2 text-xs text-slate-500 font-mono">
                    Receipt: {receipt.digest.slice(0, 16)}...
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .glass-panel {
          background: rgba(30, 30, 30, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
