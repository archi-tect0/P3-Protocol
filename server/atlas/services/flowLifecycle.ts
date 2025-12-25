import { flowEventBus } from '../../flows/eventBus';
import type { Session } from '../types';

export type FlowStatus = 'running' | 'success' | 'failed' | 'gated';
export type StepStatus = 'running' | 'complete' | 'error' | 'gated';

export interface FlowStartEvent {
  type: 'flow-start';
  id: string;
  flowKey: string;
  manifestVersion?: string;
  startedAt: number;
  sessionWallet: string;
  labels: string[];
  security: {
    visibility: 'public' | 'wallet-gated' | 'admin-only';
  };
}

export interface StepStartEvent {
  type: 'step-start';
  id: string;
  flowId: string;
  stepId: string;
  name: string;
  inputSummary?: Record<string, unknown>;
}

export interface StepCompleteEvent {
  type: 'step-complete';
  id: string;
  flowId: string;
  stepId: string;
  name: string;
  status: StepStatus;
  outputSummary?: Record<string, unknown>;
  durationMs: number;
}

export interface FlowErrorEvent {
  type: 'flow-error';
  id: string;
  flowId: string;
  stepId?: string;
  code: string;
  message: string;
  retryable: boolean;
}

export interface FlowCompleteEvent {
  type: 'flow-complete';
  id: string;
  flowKey: string;
  status: FlowStatus;
  durationMs: number;
  outputSummary?: Record<string, unknown>;
}

export interface CanvasMetadata {
  display: {
    type: 'card' | 'pipeline';
    title: string;
    subtitle?: string;
  };
  fields?: Array<{
    label: string;
    key: string;
    format: 'number' | 'currency' | 'percentage' | 'text' | 'time';
  }>;
  steps?: Array<{
    id: string;
    name: string;
    kind: 'fetch' | 'transform' | 'aggregate' | 'external';
    expectedOutput?: string;
  }>;
}

export interface FlowContext {
  flowId: string;
  flowKey: string;
  wallet: string;
  startTime: number;
  stepCount: number;
  visibility: 'public' | 'wallet-gated' | 'admin-only';
  labels: string[];
  canvas?: CanvasMetadata;
}

export function generateFlowId(flowKey: string): string {
  return `${flowKey.replace(/\./g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createFlowContext(
  flowKey: string,
  session: Session,
  options: {
    visibility?: 'public' | 'wallet-gated' | 'admin-only';
    labels?: string[];
    canvas?: CanvasMetadata;
  } = {}
): FlowContext {
  return {
    flowId: generateFlowId(flowKey),
    flowKey,
    wallet: session.wallet,
    startTime: Date.now(),
    stepCount: 0,
    visibility: options.visibility || 'public',
    labels: options.labels || [],
    canvas: options.canvas,
  };
}

export function emitFlowStart(ctx: FlowContext): void {
  const event: FlowStartEvent = {
    type: 'flow-start',
    id: `${ctx.flowId}-start`,
    flowKey: ctx.flowKey,
    startedAt: ctx.startTime,
    sessionWallet: ctx.wallet,
    labels: ctx.labels,
    security: {
      visibility: ctx.visibility,
    },
  };
  
  flowEventBus.emit(ctx.flowId, event);
}

export function emitStepStart(
  ctx: FlowContext,
  stepName: string,
  inputSummary?: Record<string, unknown>
): string {
  ctx.stepCount++;
  const stepId = `step-${ctx.stepCount}`;
  
  const event: StepStartEvent = {
    type: 'step-start',
    id: `${ctx.flowId}-${stepId}-start`,
    flowId: ctx.flowId,
    stepId,
    name: stepName,
    inputSummary,
  };
  
  flowEventBus.emit(ctx.flowId, event);
  return stepId;
}

export function emitStepComplete(
  ctx: FlowContext,
  stepId: string,
  stepName: string,
  status: StepStatus,
  startTime: number,
  outputSummary?: Record<string, unknown>
): void {
  const event: StepCompleteEvent = {
    type: 'step-complete',
    id: `${ctx.flowId}-${stepId}-complete`,
    flowId: ctx.flowId,
    stepId,
    name: stepName,
    status,
    outputSummary,
    durationMs: Date.now() - startTime,
  };
  
  flowEventBus.emit(ctx.flowId, event);
}

export function emitFlowError(
  ctx: FlowContext,
  code: string,
  message: string,
  stepId?: string,
  retryable = false
): void {
  const event: FlowErrorEvent = {
    type: 'flow-error',
    id: `${ctx.flowId}-error`,
    flowId: ctx.flowId,
    stepId,
    code,
    message,
    retryable,
  };
  
  flowEventBus.emit(ctx.flowId, event);
}

export function emitFlowComplete(
  ctx: FlowContext,
  status: FlowStatus,
  outputSummary?: Record<string, unknown>
): void {
  const event: FlowCompleteEvent = {
    type: 'flow-complete',
    id: `${ctx.flowId}-complete`,
    flowKey: ctx.flowKey,
    status,
    durationMs: Date.now() - ctx.startTime,
    outputSummary,
  };
  
  flowEventBus.emit(ctx.flowId, event);
}

export function emitGatedAccess(ctx: FlowContext, reason: string): void {
  emitFlowError(ctx, 'UNAUTHORIZED', reason, undefined, false);
  emitFlowComplete(ctx, 'gated', { reason });
}

export async function withFlowLifecycle<T>(
  flowKey: string,
  session: Session,
  options: {
    visibility?: 'public' | 'wallet-gated' | 'admin-only';
    labels?: string[];
    canvas?: CanvasMetadata;
  },
  handler: (ctx: FlowContext, helpers: FlowHelpers) => Promise<T>
): Promise<T & { flowId: string }> {
  const ctx = createFlowContext(flowKey, session, options);
  emitFlowStart(ctx);
  
  const helpers: FlowHelpers = {
    step: async <R>(stepName: string, fn: () => Promise<R>, inputSummary?: Record<string, unknown>): Promise<R> => {
      const stepStart = Date.now();
      const stepId = emitStepStart(ctx, stepName, inputSummary);
      
      try {
        const result = await fn();
        emitStepComplete(ctx, stepId, stepName, 'complete', stepStart, 
          typeof result === 'object' ? summarize(result) : { value: result }
        );
        return result;
      } catch (error) {
        emitStepComplete(ctx, stepId, stepName, 'error', stepStart, { error: (error as Error).message });
        throw error;
      }
    },
    
    gated: (reason: string) => {
      emitGatedAccess(ctx, reason);
    },
    
    ctx,
  };
  
  try {
    const result = await handler(ctx, helpers);
    emitFlowComplete(ctx, 'success', typeof result === 'object' ? summarize(result) : undefined);
    return { ...result, flowId: ctx.flowId };
  } catch (error) {
    emitFlowError(ctx, 'EXECUTION_ERROR', (error as Error).message, undefined, false);
    emitFlowComplete(ctx, 'failed', { error: (error as Error).message });
    throw error;
  }
}

export interface FlowHelpers {
  step: <R>(stepName: string, fn: () => Promise<R>, inputSummary?: Record<string, unknown>) => Promise<R>;
  gated: (reason: string) => void;
  ctx: FlowContext;
}

function summarize(obj: unknown): Record<string, unknown> {
  if (obj === null || obj === undefined) return {};
  if (typeof obj !== 'object') return { value: obj };
  
  const summary: Record<string, unknown> = {};
  const entries = Object.entries(obj as Record<string, unknown>);
  
  for (const [key, value] of entries.slice(0, 10)) {
    if (Array.isArray(value)) {
      summary[key] = { type: 'array', length: value.length };
    } else if (typeof value === 'object' && value !== null) {
      summary[key] = { type: 'object', keys: Object.keys(value).slice(0, 5) };
    } else if (typeof value === 'string' && value.length > 100) {
      summary[key] = value.slice(0, 100) + '...';
    } else {
      summary[key] = value;
    }
  }
  
  if (entries.length > 10) {
    summary._truncated = entries.length - 10;
  }
  
  return summary;
}

export const ANALYTICS_CANVAS_METADATA: Record<string, CanvasMetadata> = {
  'analytics.overview': {
    display: { type: 'card', title: 'Analytics Overview', subtitle: 'Site traffic summary' },
    fields: [
      { label: 'Total Views', key: 'totalViews', format: 'number' },
      { label: 'Unique Visitors', key: 'uniqueVisitors', format: 'number' },
    ],
    steps: [
      { id: 'fetch', name: 'Fetch Metrics', kind: 'fetch', expectedOutput: 'Analytics data' },
      { id: 'aggregate', name: 'Aggregate Summary', kind: 'aggregate', expectedOutput: 'Totals' },
    ],
  },
  'analytics.traffic': {
    display: { type: 'card', title: 'Traffic Stats', subtitle: 'Visitor counts' },
    fields: [
      { label: 'Page Views', key: 'totalViews', format: 'number' },
      { label: 'Visitors', key: 'uniqueVisitors', format: 'number' },
    ],
    steps: [
      { id: 'fetch', name: 'Fetch Traffic', kind: 'fetch', expectedOutput: 'Traffic data' },
    ],
  },
  'analytics.referrers': {
    display: { type: 'pipeline', title: 'Top Referrers', subtitle: 'Traffic sources' },
    fields: [
      { label: 'Source', key: 'referrer', format: 'text' },
      { label: 'Views', key: 'views', format: 'number' },
    ],
    steps: [
      { id: 'fetch', name: 'Fetch Referrers', kind: 'fetch', expectedOutput: 'Referrer list' },
      { id: 'filter', name: 'Apply Filters', kind: 'transform', expectedOutput: 'Filtered list' },
    ],
  },
  'analytics.pages': {
    display: { type: 'pipeline', title: 'Top Pages', subtitle: 'Most viewed pages' },
    fields: [
      { label: 'Page', key: 'route', format: 'text' },
      { label: 'Views', key: 'views', format: 'number' },
    ],
    steps: [
      { id: 'fetch', name: 'Fetch Pages', kind: 'fetch', expectedOutput: 'Page list' },
    ],
  },
  'analytics.devices': {
    display: { type: 'card', title: 'Device Breakdown', subtitle: 'Browsers and devices' },
    fields: [
      { label: 'Device', key: 'device', format: 'text' },
      { label: 'Browser', key: 'browser', format: 'text' },
      { label: 'Views', key: 'views', format: 'number' },
    ],
    steps: [
      { id: 'fetch', name: 'Fetch Devices', kind: 'fetch', expectedOutput: 'Device stats' },
    ],
  },
};

export const WEB3_CANVAS_METADATA: Record<string, CanvasMetadata> = {
  'web3.wallet_balance': {
    display: { type: 'card', title: 'Wallet Balance', subtitle: 'Token holdings' },
    fields: [
      { label: 'Balance', key: 'balance', format: 'currency' },
      { label: 'Chain', key: 'chain', format: 'text' },
    ],
    steps: [
      { id: 'fetch', name: 'Query Provider', kind: 'external', expectedOutput: 'Balance data' },
    ],
  },
  'web3.nft_holdings': {
    display: { type: 'pipeline', title: 'NFT Holdings', subtitle: 'Your NFT collection' },
    fields: [
      { label: 'Collection', key: 'collection', format: 'text' },
      { label: 'Count', key: 'count', format: 'number' },
    ],
    steps: [
      { id: 'fetch', name: 'Query NFTs', kind: 'external', expectedOutput: 'NFT list' },
      { id: 'group', name: 'Group by Collection', kind: 'aggregate', expectedOutput: 'Collections' },
    ],
  },
  'web3.gas_price': {
    display: { type: 'card', title: 'Gas Price', subtitle: 'Current network fees' },
    fields: [
      { label: 'Gas', key: 'gasPrice', format: 'text' },
      { label: 'Chain', key: 'chain', format: 'text' },
    ],
    steps: [
      { id: 'fetch', name: 'Query Gas', kind: 'external', expectedOutput: 'Gas data' },
    ],
  },
  'web3.portfolio': {
    display: { type: 'pipeline', title: 'Portfolio Brief', subtitle: 'Multi-chain overview' },
    fields: [
      { label: 'Chain', key: 'chain', format: 'text' },
      { label: 'Value', key: 'value', format: 'currency' },
    ],
    steps: [
      { id: 'eth', name: 'Check ETH', kind: 'external', expectedOutput: 'ETH balance' },
      { id: 'sol', name: 'Check SOL', kind: 'external', expectedOutput: 'SOL balance' },
      { id: 'gas', name: 'Check Gas', kind: 'external', expectedOutput: 'Gas prices' },
      { id: 'aggregate', name: 'Aggregate', kind: 'aggregate', expectedOutput: 'Portfolio summary' },
    ],
  },
};
