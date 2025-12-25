import { flowEventBus } from './eventBus';
import { startFlowTrace, logStep, completeStep, endFlowTrace, FlowTrace } from './tracing';

type StepCtx = {
  wallet: string;
  data: Record<string, unknown>;
  flowId?: string;
  correlationId?: string;
  errors?: string[];
};

type StepFn = (ctx: StepCtx) => Promise<StepCtx>;
type RollbackFn = (ctx: StepCtx) => Promise<void>;

interface PipelineStep {
  name: string;
  fn: StepFn;
  rollback?: RollbackFn;
  critical?: boolean;
}

type PipelineSnapshot = {
  idx: number;
  stepName?: string;
  data: Record<string, unknown>;
  timestamp: number;
  status: 'running' | 'success' | 'failed' | 'rolledback';
};

export class FlowPipeline {
  private steps: PipelineStep[] = [];
  private onUpdate?: (snapshot: PipelineSnapshot) => void;
  private trace: FlowTrace | null = null;

  add(
    name: string,
    step: StepFn,
    options?: { rollback?: RollbackFn; critical?: boolean }
  ): FlowPipeline {
    this.steps.push({
      name,
      fn: step,
      rollback: options?.rollback,
      critical: options?.critical ?? false,
    });
    return this;
  }

  subscribe(fn: (snapshot: PipelineSnapshot) => void): FlowPipeline {
    this.onUpdate = fn;
    return this;
  }

  private emitUpdate(snapshot: PipelineSnapshot): void {
    this.onUpdate?.(snapshot);
    if (this.trace) {
      flowEventBus.emit(this.trace.flowId, {
        type: 'step_update',
        ...snapshot,
        flowId: this.trace.flowId,
        correlationId: this.trace.correlationId,
      });
    }
  }

  async run(initial: StepCtx): Promise<StepCtx> {
    this.trace = startFlowTrace(initial.wallet);
    let ctx: StepCtx = {
      ...initial,
      flowId: this.trace.flowId,
      correlationId: this.trace.correlationId,
    };

    const completedSteps: number[] = [];

    for (const [idx, step] of this.steps.entries()) {
      const stepStart = Date.now();

      logStep(this.trace.flowId, {
        idx,
        name: step.name,
        startedAt: stepStart,
        status: 'running',
      });

      this.emitUpdate({
        idx,
        stepName: step.name,
        data: ctx.data,
        timestamp: stepStart,
        status: 'running',
      });

      try {
        ctx = await step.fn(ctx);
        completedSteps.push(idx);

        completeStep(this.trace.flowId, idx, 'success');

        this.emitUpdate({
          idx,
          stepName: step.name,
          data: ctx.data,
          timestamp: Date.now(),
          status: 'success',
        });
      } catch (error) {
        const errorMsg = (error as Error).message;

        completeStep(this.trace.flowId, idx, 'failed', errorMsg);

        this.emitUpdate({
          idx,
          stepName: step.name,
          data: { ...ctx.data, error: errorMsg },
          timestamp: Date.now(),
          status: 'failed',
        });

        if (step.critical) {
          await this.executeRollbacks(ctx, completedSteps);
          endFlowTrace(this.trace.flowId);
          throw new Error(`Flow failed at step ${idx} (${step.name}): ${errorMsg}`);
        }

        ctx.errors = ctx.errors || [];
        ctx.errors.push(`Step ${step.name} failed: ${errorMsg}`);
      }
    }

    endFlowTrace(this.trace.flowId);
    return ctx;
  }

  private async executeRollbacks(ctx: StepCtx, completedSteps: number[]): Promise<void> {
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const stepIdx = completedSteps[i];
      const step = this.steps[stepIdx];

      if (step.rollback) {
        try {
          await step.rollback(ctx);
          if (this.trace) {
            completeStep(this.trace.flowId, stepIdx, 'rolledback');
          }

          this.emitUpdate({
            idx: stepIdx,
            stepName: step.name,
            data: ctx.data,
            timestamp: Date.now(),
            status: 'rolledback',
          });
        } catch (rollbackError) {
          console.error(`[FlowPipeline] Rollback failed for step ${step.name}:`, rollbackError);
        }
      }
    }
  }

  async runParallel(initial: StepCtx): Promise<StepCtx> {
    this.trace = startFlowTrace(initial.wallet);
    const ctx: StepCtx = {
      ...initial,
      flowId: this.trace.flowId,
      correlationId: this.trace.correlationId,
    };

    const results = await Promise.allSettled(
      this.steps.map(({ name, fn }, idx) => {
        logStep(this.trace!.flowId, {
          idx,
          name,
          startedAt: Date.now(),
          status: 'running',
        });
        return fn({ ...ctx });
      })
    );

    const mergedData: Record<string, unknown> = { ...initial.data };
    const errors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const step = this.steps[i];

      if (result.status === 'fulfilled') {
        Object.assign(mergedData, result.value.data);
        completeStep(this.trace.flowId, i, 'success');

        this.emitUpdate({
          idx: i,
          stepName: step.name,
          data: result.value.data,
          timestamp: Date.now(),
          status: 'success',
        });
      } else {
        const errorMsg = String(result.reason);
        errors.push(`Step ${step.name} failed: ${errorMsg}`);
        completeStep(this.trace.flowId, i, 'failed', errorMsg);

        this.emitUpdate({
          idx: i,
          stepName: step.name,
          data: { error: errorMsg },
          timestamp: Date.now(),
          status: 'failed',
        });
      }
    }

    endFlowTrace(this.trace.flowId);

    return {
      wallet: initial.wallet,
      flowId: this.trace.flowId,
      correlationId: this.trace.correlationId,
      data: mergedData,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getFlowId(): string | null {
    return this.trace?.flowId ?? null;
  }

  getCorrelationId(): string | null {
    return this.trace?.correlationId ?? null;
  }
}

export function createPipeline(): FlowPipeline {
  return new FlowPipeline();
}
