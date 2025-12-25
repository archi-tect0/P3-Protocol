import { flowEventBus } from '../../flows/eventBus';

export type FlowEvent =
  | { type: 'flow-start'; flowId: string; flowKey: string; startedAt: string; sessionWallet?: string; labels?: string[] }
  | { type: 'step-start'; flowId: string; stepId: string; name: string; inputSummary?: unknown }
  | { type: 'step-complete'; flowId: string; stepId: string; name: string; outputSummary?: unknown; rawPayloadRef?: string; durationMs?: number }
  | { type: 'flow-error'; flowId: string; stepId?: string; code: string; message: string; retryable?: boolean }
  | { type: 'flow-complete'; flowId: string; flowKey: string; status: 'success' | 'error' | 'gated'; durationMs?: number; outputSummary?: unknown };

export class EventPublisher {
  private flowId: string;
  private flowKey: string;
  private startTime: number;

  constructor(flowKey: string, sessionWallet?: string, labels?: string[]) {
    this.flowId = `${flowKey.replace(/[.:]/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.flowKey = flowKey;
    this.startTime = Date.now();
    
    this.emit({
      type: 'flow-start',
      flowId: this.flowId,
      flowKey,
      startedAt: new Date().toISOString(),
      sessionWallet,
      labels,
    });
  }

  get id() { return this.flowId; }

  emit(evt: FlowEvent) {
    flowEventBus.emit(this.flowId, evt);
  }

  stepStart(stepId: string, name: string, inputSummary?: unknown) {
    this.emit({ type: 'step-start', flowId: this.flowId, stepId, name, inputSummary });
  }

  stepComplete(stepId: string, name: string, outputSummary?: unknown, rawPayloadRef?: string, durationMs?: number) {
    this.emit({ type: 'step-complete', flowId: this.flowId, stepId, name, outputSummary, rawPayloadRef, durationMs });
  }

  error(code: string, message: string, stepId?: string, retryable = false) {
    this.emit({ type: 'flow-error', flowId: this.flowId, stepId, code, message, retryable });
  }

  complete(status: 'success' | 'error' | 'gated', outputSummary?: unknown) {
    this.emit({
      type: 'flow-complete',
      flowId: this.flowId,
      flowKey: this.flowKey,
      status,
      durationMs: Date.now() - this.startTime,
      outputSummary,
    });
  }

  gated(reason: string) {
    this.complete('gated', { reason });
  }
}

export function createPublisher(flowKey: string, sessionWallet?: string, labels?: string[]): EventPublisher {
  return new EventPublisher(flowKey, sessionWallet, labels);
}

export function summarize(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return raw;
  
  if (Array.isArray(raw)) {
    return { type: 'array', length: raw.length, sample: raw.slice(0, 3).map(summarize) };
  }
  
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  const summary: Record<string, unknown> = {};
  
  for (const key of keys.slice(0, 10)) {
    const val = obj[key];
    if (typeof val === 'string' && val.length > 200) {
      summary[key] = val.slice(0, 200) + '...';
    } else if (Array.isArray(val)) {
      summary[key] = { type: 'array', length: val.length };
    } else if (typeof val === 'object' && val !== null) {
      summary[key] = { type: 'object', keys: Object.keys(val).slice(0, 5) };
    } else {
      summary[key] = val;
    }
  }
  
  if (keys.length > 10) {
    summary._truncated = keys.length - 10;
  }
  
  return summary;
}

export function redact(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return raw;
  
  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'authorization', 'cookie', 'ip', 'email'];
  
  if (Array.isArray(raw)) {
    return raw.map(redact);
  }
  
  const obj = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  
  for (const [key, val] of Object.entries(obj)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      result[key] = redact(val);
    } else {
      result[key] = val;
    }
  }
  
  return result;
}
