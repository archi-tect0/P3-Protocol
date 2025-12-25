import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, Lock, AlertCircle } from 'lucide-react';

type StepStatus = 'pending' | 'running' | 'complete' | 'error' | 'gated';

interface PipelineStep {
  id: string;
  name: string;
  status: StepStatus;
  inputSummary?: unknown;
  outputSummary?: unknown;
  durationMs?: number;
  error?: string;
}

interface CanvasPipelineProps {
  title: string;
  subtitle?: string;
  steps: PipelineStep[];
  status: 'running' | 'success' | 'error' | 'gated';
  visibility?: 'public' | 'wallet-gated' | 'admin-only';
  durationMs?: number;
}

export function CanvasPipeline({ title, subtitle, steps, status, visibility: _visibility = 'public', durationMs }: CanvasPipelineProps) {
  const getStatusIcon = (stepStatus: StepStatus) => {
    switch (stepStatus) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'gated':
        return <Lock className="h-5 w-5 text-yellow-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'gated':
        return <Badge variant="secondary">Gated</Badge>;
      default:
        return <Badge variant="outline">Running</Badge>;
    }
  };

  return (
    <Card className="w-full" data-testid="canvas-pipeline">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg" data-testid="canvas-pipeline-title">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {durationMs !== undefined && (
              <span className="text-sm text-muted-foreground">{durationMs}ms</span>
            )}
            {getStatusBadge()}
          </div>
        </div>
        {subtitle && <p className="text-sm text-muted-foreground" data-testid="canvas-pipeline-subtitle">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        <div className="relative" data-testid="canvas-pipeline-steps">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-start gap-4 pb-4" data-testid={`pipeline-step-${step.id}`}>
              <div className="flex flex-col items-center">
                {getStatusIcon(step.status)}
                {idx < steps.length - 1 && (
                  <div className={`w-0.5 h-full mt-2 ${step.status === 'complete' ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium" data-testid={`step-name-${step.id}`}>{step.name}</span>
                  {step.durationMs !== undefined && (
                    <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>
                  )}
                </div>
                {step.outputSummary != null && (
                  <pre className="mt-1 text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto max-h-24" data-testid={`step-output-${step.id}`}>
                    {String(typeof step.outputSummary === 'string' ? step.outputSummary : JSON.stringify(step.outputSummary, null, 2))}
                  </pre>
                )}
                {step.error && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-500" data-testid={`step-error-${step.id}`}>
                    <AlertCircle className="h-3 w-3" />
                    {step.error}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FlowEvent {
  type: string;
  flowId?: string;
  stepId?: string;
  name?: string;
  status?: string;
  inputSummary?: unknown;
  outputSummary?: unknown;
  durationMs?: number;
  message?: string;
}

export function pipelineFromEvents(events: FlowEvent[], title: string, subtitle?: string): CanvasPipelineProps {
  const steps: PipelineStep[] = [];
  let flowStatus: 'running' | 'success' | 'error' | 'gated' = 'running';
  let totalDuration: number | undefined;

  const stepMap = new Map<string, PipelineStep>();

  for (const evt of events) {
    if (evt.type === 'step-start' && evt.stepId && evt.name) {
      stepMap.set(evt.stepId, {
        id: evt.stepId,
        name: evt.name,
        status: 'running',
        inputSummary: evt.inputSummary,
      });
    }

    if (evt.type === 'step-complete' && evt.stepId) {
      const step = stepMap.get(evt.stepId);
      if (step) {
        step.status = 'complete';
        step.outputSummary = evt.outputSummary;
        step.durationMs = evt.durationMs;
      }
    }

    if (evt.type === 'flow-error' && evt.stepId) {
      const step = stepMap.get(evt.stepId);
      if (step) {
        step.status = 'error';
        step.error = evt.message;
      }
    }

    if (evt.type === 'flow-complete') {
      flowStatus = (evt.status as 'success' | 'error' | 'gated') || 'success';
      totalDuration = evt.durationMs;
    }
  }

  for (const step of stepMap.values()) {
    steps.push(step);
  }

  return {
    title,
    subtitle,
    steps,
    status: flowStatus,
    durationMs: totalDuration,
  };
}
