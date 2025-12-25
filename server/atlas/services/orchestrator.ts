import { createHash } from 'crypto';
import type { Session, FlowStep, Receipt } from '../types';
import { atlasConfig } from '../config';
import { ensureConsent, reviewGate, ConsentError, RoleError } from './governance';
import { executeEndpoint, ExecutionError, ValidationError } from './executor';
import { recordUsage } from './observability';

export interface FlowResult {
  success: boolean;
  receipts: Receipt[];
  heldForReview: string[];
  errors: string[];
}

function generateDigest(step: FlowStep, result: any): string {
  const payload = JSON.stringify({ step, result, ts: Date.now() });
  return createHash('sha256').update(payload).digest('hex');
}

export async function runFlow(steps: FlowStep[], session: Session): Promise<FlowResult> {
  if (steps.length > atlasConfig.maxFlowSteps) {
    throw new Error(`Flow exceeds maximum steps (${atlasConfig.maxFlowSteps})`);
  }
  
  const receipts: Receipt[] = [];
  const heldForReview: string[] = [];
  const errors: string[] = [];
  let success = true;
  
  for (const step of steps) {
    const startTime = Date.now();
    let receipt: Receipt;
    
    try {
      await ensureConsent(session, step);
      
      const reviewStatus = await reviewGate(step);
      
      if (reviewStatus === 'review') {
        receipt = {
          step: step.key,
          status: 'held_for_review',
          ts: Date.now(),
        };
        heldForReview.push(step.key);
        
        recordUsage({
          endpoint: step.key,
          wallet: session.wallet,
          status: 'held_for_review',
          duration: Date.now() - startTime,
          ts: Date.now(),
        });
      } else {
        const result = await executeEndpoint(step.key, step.args, session);
        const digest = generateDigest(step, result);
        
        receipt = {
          step: step.key,
          status: 'ok',
          digest,
          ts: Date.now(),
          result,
        };
        
        recordUsage({
          endpoint: step.key,
          wallet: session.wallet,
          status: 'ok',
          duration: Date.now() - startTime,
          ts: Date.now(),
        });
      }
    } catch (error) {
      success = false;
      
      let errorMessage: string;
      
      if (error instanceof ConsentError) {
        errorMessage = `Missing scopes: ${error.missingScopes.join(', ')}`;
      } else if (error instanceof RoleError) {
        errorMessage = `Insufficient role: required ${error.requiredRoles.join(' or ')}`;
      } else if (error instanceof ValidationError) {
        errorMessage = `Invalid arguments: ${error.invalidArgs.join(', ')}`;
      } else if (error instanceof ExecutionError) {
        errorMessage = `Execution failed: ${error.originalError.message}`;
      } else {
        errorMessage = (error as Error).message;
      }
      
      errors.push(`${step.key}: ${errorMessage}`);
      
      receipt = {
        step: step.key,
        status: 'error',
        ts: Date.now(),
        error: errorMessage,
      };
      
      recordUsage({
        endpoint: step.key,
        wallet: session.wallet,
        status: 'error',
        error: errorMessage,
        duration: Date.now() - startTime,
        ts: Date.now(),
      });
      
      break;
    }
    
    receipts.push(receipt);
  }
  
  return {
    success: success && heldForReview.length === 0,
    receipts,
    heldForReview,
    errors,
  };
}

export async function runSingleStep(step: FlowStep, session: Session): Promise<Receipt> {
  const result = await runFlow([step], session);
  return result.receipts[0];
}

export function verifyReceipt(receipt: Receipt, step: FlowStep, result: any): boolean {
  if (!receipt.digest) {
    return false;
  }
  
  const expectedDigest = generateDigest(step, result);
  return receipt.digest === expectedDigest;
}
