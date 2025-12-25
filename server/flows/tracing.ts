import crypto from 'crypto';

export interface FlowTrace {
  flowId: string;
  correlationId: string;
  startedAt: number;
  wallet: string;
  steps: StepTrace[];
}

export interface StepTrace {
  idx: number;
  name: string;
  provider?: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolledback';
  error?: string;
  metadata?: Record<string, unknown>;
}

const activeTraces = new Map<string, FlowTrace>();
const completedTraces: FlowTrace[] = [];
const MAX_COMPLETED = 100;

export function startFlowTrace(wallet: string): FlowTrace {
  const trace: FlowTrace = {
    flowId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    startedAt: Date.now(),
    wallet: wallet.toLowerCase(),
    steps: [],
  };
  activeTraces.set(trace.flowId, trace);
  return trace;
}

export function logStep(
  flowId: string,
  step: Omit<StepTrace, 'status'> & { status?: StepTrace['status'] }
): void {
  const trace = activeTraces.get(flowId);
  if (!trace) return;

  const existing = trace.steps.find(s => s.idx === step.idx);
  if (existing) {
    Object.assign(existing, step);
    if (step.completedAt && existing.startedAt) {
      existing.durationMs = step.completedAt - existing.startedAt;
    }
  } else {
    trace.steps.push({
      status: 'pending',
      ...step,
    });
  }
}

export function completeStep(
  flowId: string,
  idx: number,
  status: 'success' | 'failed' | 'rolledback',
  error?: string
): void {
  const trace = activeTraces.get(flowId);
  if (!trace) return;

  const step = trace.steps.find(s => s.idx === idx);
  if (step) {
    step.status = status;
    step.completedAt = Date.now();
    step.durationMs = step.completedAt - step.startedAt;
    if (error) step.error = error;
  }
}

export function endFlowTrace(flowId: string): FlowTrace | null {
  const trace = activeTraces.get(flowId);
  if (!trace) return null;

  activeTraces.delete(flowId);
  completedTraces.unshift(trace);
  
  while (completedTraces.length > MAX_COMPLETED) {
    completedTraces.pop();
  }

  return trace;
}

export function getActiveTrace(flowId: string): FlowTrace | null {
  return activeTraces.get(flowId) || null;
}

export function getTraceByCorrelation(correlationId: string): FlowTrace | null {
  for (const trace of activeTraces.values()) {
    if (trace.correlationId === correlationId) return trace;
  }
  for (const trace of completedTraces) {
    if (trace.correlationId === correlationId) return trace;
  }
  return null;
}

export function getRecentTraces(limit: number = 20): FlowTrace[] {
  return completedTraces.slice(0, limit);
}

export function getActiveFlowCount(): number {
  return activeTraces.size;
}
