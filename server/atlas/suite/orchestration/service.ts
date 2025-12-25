import { db } from '../../../db';
import { 
  orchestrationFlows, 
  orchestrationSteps, 
  orchestrationAdapters,
  atlasReceipts,
  walletScopes,
  type OrchestrationFlow,
  type OrchestrationStep,
  type OrchestrationAdapter,
  type AtlasReceipt,
  type WalletScope as WalletScopeRecord
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

export interface WalletScope {
  walletAddress: string;
  sessionId: string;
  profileId?: string;
}

export interface StepInit {
  sourceArtifactId?: string;
  targetArtifactId?: string;
  adapterId?: string;
  payload?: Record<string, unknown>;
}

export interface AdapterInit {
  adapterId: string;
  name: string;
  version: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface FlowExecutionResult {
  flow: OrchestrationFlow;
  steps: OrchestrationStep[];
  receipts: AtlasReceipt[];
  completedAt: Date;
}

function computeHash(content: string, prevHash?: string): string {
  return createHash('sha256').update((prevHash || '') + content).digest('hex');
}

export class OrchestrationService {
  private async getOrCreateWalletScope(scope: WalletScope): Promise<WalletScopeRecord> {
    const existing = await db.select()
      .from(walletScopes)
      .where(and(
        eq(walletScopes.walletAddress, scope.walletAddress.toLowerCase()),
        eq(walletScopes.sessionId, scope.sessionId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [created] = await db.insert(walletScopes).values({
      walletAddress: scope.walletAddress.toLowerCase(),
      sessionId: scope.sessionId,
      profileId: scope.profileId || null
    }).returning();
    
    return created;
  }

  private async createReceipt(
    artifactId: string, 
    scopeId: string, 
    op: 'insertText' | 'deleteText' | 'applyStyle' | 'setCell' | 'createChart' | 'defineRange' | 'createDoc' | 'createSheet' | 'exportDoc' | 'exportSheet',
    meta?: Record<string, unknown>
  ): Promise<AtlasReceipt> {
    const latestReceipts = await db.select()
      .from(atlasReceipts)
      .where(eq(atlasReceipts.artifactId, artifactId))
      .orderBy(desc(atlasReceipts.createdAt))
      .limit(1);
    
    const prevHash = latestReceipts.length > 0 ? latestReceipts[0].nextHash : undefined;
    const nextHash = computeHash(JSON.stringify({ op, meta, artifactId, timestamp: Date.now() }), prevHash);
    
    const [receipt] = await db.insert(atlasReceipts).values({
      artifactId,
      op,
      prevHash: prevHash || null,
      nextHash,
      actorScopeId: scopeId,
      meta: meta || null
    }).returning();
    
    return receipt;
  }

  async createFlow(
    scope: WalletScope, 
    name: string, 
    linkedArtifactIds?: string[]
  ): Promise<{ flow: OrchestrationFlow }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const [flow] = await db.insert(orchestrationFlows).values({
      walletScopeId: walletScopeRecord.id,
      name,
      status: 'pending',
      linkedArtifactIds: linkedArtifactIds || null
    }).returning();
    
    return { flow };
  }

  async addStep(
    flowId: string, 
    step: StepInit
  ): Promise<{ step: OrchestrationStep }> {
    const flows = await db.select()
      .from(orchestrationFlows)
      .where(eq(orchestrationFlows.id, flowId))
      .limit(1);
    
    if (flows.length === 0) {
      throw new Error(`Flow ${flowId} not found`);
    }
    
    const maxOrderResult = await db.select({ 
      maxOrder: sql<number>`COALESCE(MAX(${orchestrationSteps.stepOrder}), 0)` 
    })
      .from(orchestrationSteps)
      .where(eq(orchestrationSteps.flowId, flowId));
    
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? 0) + 1;
    
    const [newStep] = await db.insert(orchestrationSteps).values({
      flowId,
      stepOrder: nextOrder,
      sourceArtifactId: step.sourceArtifactId || null,
      targetArtifactId: step.targetArtifactId || null,
      adapterId: step.adapterId || null,
      payload: step.payload || null
    }).returning();
    
    return { step: newStep };
  }

  async executeFlow(
    flowId: string, 
    scope: WalletScope
  ): Promise<FlowExecutionResult> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const flows = await db.select()
      .from(orchestrationFlows)
      .where(eq(orchestrationFlows.id, flowId))
      .limit(1);
    
    if (flows.length === 0) {
      throw new Error(`Flow ${flowId} not found`);
    }
    
    const flow = flows[0];
    
    if (flow.walletScopeId !== walletScopeRecord.id) {
      throw new Error('Unauthorized: Flow does not belong to this scope');
    }
    
    if (flow.status === 'running') {
      throw new Error('Flow is already running');
    }
    
    if (flow.status === 'completed') {
      throw new Error('Flow has already completed');
    }
    
    if (flow.status === 'cancelled') {
      throw new Error('Flow has been cancelled');
    }
    
    await db.update(orchestrationFlows)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(orchestrationFlows.id, flowId));
    
    const steps = await db.select()
      .from(orchestrationSteps)
      .where(eq(orchestrationSteps.flowId, flowId))
      .orderBy(orchestrationSteps.stepOrder);
    
    const receipts: AtlasReceipt[] = [];
    
    try {
      for (const step of steps) {
        if (step.targetArtifactId) {
          const receipt = await this.createReceipt(
            step.targetArtifactId,
            walletScopeRecord.id,
            'setCell',
            {
              flowId,
              stepId: step.id,
              stepOrder: step.stepOrder,
              adapterId: step.adapterId,
              payload: step.payload
            }
          );
          
          await db.update(orchestrationSteps)
            .set({ receiptId: receipt.id })
            .where(eq(orchestrationSteps.id, step.id));
          
          receipts.push(receipt);
        }
      }
      
      const [updatedFlow] = await db.update(orchestrationFlows)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(orchestrationFlows.id, flowId))
        .returning();
      
      const updatedSteps = await db.select()
        .from(orchestrationSteps)
        .where(eq(orchestrationSteps.flowId, flowId))
        .orderBy(orchestrationSteps.stepOrder);
      
      return {
        flow: updatedFlow,
        steps: updatedSteps,
        receipts,
        completedAt: new Date()
      };
    } catch (error) {
      await db.update(orchestrationFlows)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(orchestrationFlows.id, flowId));
      
      throw error;
    }
  }

  async registerAdapter(adapter: AdapterInit): Promise<{ adapter: OrchestrationAdapter }> {
    const existing = await db.select()
      .from(orchestrationAdapters)
      .where(eq(orchestrationAdapters.adapterId, adapter.adapterId))
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(orchestrationAdapters)
        .set({
          name: adapter.name,
          version: adapter.version,
          description: adapter.description || null,
          inputSchema: adapter.inputSchema || null,
          outputSchema: adapter.outputSchema || null,
          config: adapter.config || null,
          updatedAt: new Date()
        })
        .where(eq(orchestrationAdapters.adapterId, adapter.adapterId))
        .returning();
      
      return { adapter: updated };
    }
    
    const [created] = await db.insert(orchestrationAdapters).values({
      adapterId: adapter.adapterId,
      name: adapter.name,
      version: adapter.version,
      description: adapter.description || null,
      inputSchema: adapter.inputSchema || null,
      outputSchema: adapter.outputSchema || null,
      config: adapter.config || null,
      status: 'active'
    }).returning();
    
    return { adapter: created };
  }

  async listAdapters(): Promise<OrchestrationAdapter[]> {
    const adapters = await db.select()
      .from(orchestrationAdapters)
      .where(eq(orchestrationAdapters.status, 'active'))
      .orderBy(orchestrationAdapters.name);
    
    return adapters;
  }

  async getFlow(flowId: string): Promise<{ flow: OrchestrationFlow; steps: OrchestrationStep[] } | null> {
    const flows = await db.select()
      .from(orchestrationFlows)
      .where(eq(orchestrationFlows.id, flowId))
      .limit(1);
    
    if (flows.length === 0) {
      return null;
    }
    
    const steps = await db.select()
      .from(orchestrationSteps)
      .where(eq(orchestrationSteps.flowId, flowId))
      .orderBy(orchestrationSteps.stepOrder);
    
    return { flow: flows[0], steps };
  }

  async listFlows(scope: WalletScope): Promise<OrchestrationFlow[]> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const flows = await db.select()
      .from(orchestrationFlows)
      .where(eq(orchestrationFlows.walletScopeId, walletScopeRecord.id))
      .orderBy(desc(orchestrationFlows.updatedAt));
    
    return flows;
  }

  async cancelFlow(flowId: string, scope: WalletScope): Promise<{ flow: OrchestrationFlow }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const flows = await db.select()
      .from(orchestrationFlows)
      .where(eq(orchestrationFlows.id, flowId))
      .limit(1);
    
    if (flows.length === 0) {
      throw new Error(`Flow ${flowId} not found`);
    }
    
    const flow = flows[0];
    
    if (flow.walletScopeId !== walletScopeRecord.id) {
      throw new Error('Unauthorized: Flow does not belong to this scope');
    }
    
    if (flow.status === 'completed') {
      throw new Error('Cannot cancel a completed flow');
    }
    
    if (flow.status === 'cancelled') {
      throw new Error('Flow is already cancelled');
    }
    
    const [updated] = await db.update(orchestrationFlows)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(orchestrationFlows.id, flowId))
      .returning();
    
    return { flow: updated };
  }

  async getAdapter(adapterId: string): Promise<OrchestrationAdapter | null> {
    const adapters = await db.select()
      .from(orchestrationAdapters)
      .where(eq(orchestrationAdapters.adapterId, adapterId))
      .limit(1);
    
    return adapters.length > 0 ? adapters[0] : null;
  }

  async deleteFlow(flowId: string, scope: WalletScope): Promise<void> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const flows = await db.select()
      .from(orchestrationFlows)
      .where(eq(orchestrationFlows.id, flowId))
      .limit(1);
    
    if (flows.length === 0) {
      throw new Error(`Flow ${flowId} not found`);
    }
    
    const flow = flows[0];
    
    if (flow.walletScopeId !== walletScopeRecord.id) {
      throw new Error('Unauthorized: Flow does not belong to this scope');
    }
    
    if (flow.status === 'running') {
      throw new Error('Cannot delete a running flow');
    }
    
    await db.delete(orchestrationSteps)
      .where(eq(orchestrationSteps.flowId, flowId));
    
    await db.delete(orchestrationFlows)
      .where(eq(orchestrationFlows.id, flowId));
  }
}

export const orchestrationService = new OrchestrationService();
