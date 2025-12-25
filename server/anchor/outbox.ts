/**
 * Durable Outbox Pattern for Anchor Queue
 * 
 * Implements crash recovery with:
 * - Persist-before-enqueue for durability
 * - Idempotency keys for exactly-once writes
 * - Transactional enqueue with compensation
 * - Heartbeat + lease for worker coordination
 * - Reconciliation job for orphaned events
 */

import { db } from '../db';
import { anchorOutbox, anchorReceipts, type AnchorOutbox, type AnchorReceipt } from '@shared/schema';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const STALE_THRESHOLD = 120000; // 2 minutes - jobs without heartbeat considered stale
const MAX_RETRIES = 5;

export interface OutboxEvent {
  type: string;
  appId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

function computeDigest(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Write event to outbox with durable storage before enqueue.
 * Returns the outbox ID and digest for tracking.
 */
export async function writeOutbox(event: OutboxEvent): Promise<{ id: string; digest: string; idempotencyKey: string }> {
  const digest = computeDigest(event.payload);
  const id = uuid();
  const idempotencyKey = event.idempotencyKey || `${event.appId}:${event.type}:${digest}`;
  
  const existingReceipt = await db
    .select()
    .from(anchorReceipts)
    .where(eq(anchorReceipts.idempotencyKey, idempotencyKey))
    .limit(1);
  
  if (existingReceipt.length > 0) {
    rootLogger.debug('[Outbox] Event already processed', { idempotencyKey });
    return { 
      id: existingReceipt[0].outboxId || id, 
      digest, 
      idempotencyKey 
    };
  }
  
  await db.insert(anchorOutbox).values({
    id,
    type: event.type,
    appId: event.appId,
    digest,
    payload: event.payload,
    status: 'pending',
    retryCount: 0,
  });
  
  rootLogger.info('[Outbox] Event written', { id, type: event.type, appId: event.appId });
  
  return { id, digest, idempotencyKey };
}

/**
 * Mark event as enqueued after successful queue submission.
 */
export async function markEnqueued(id: string): Promise<void> {
  await db
    .update(anchorOutbox)
    .set({ status: 'enqueued', updatedAt: new Date() })
    .where(eq(anchorOutbox.id, id));
}

/**
 * Mark event as processing with heartbeat for lease management.
 */
export async function markProcessing(id: string): Promise<void> {
  await db
    .update(anchorOutbox)
    .set({ 
      status: 'processing', 
      heartbeatAt: new Date(),
      updatedAt: new Date() 
    })
    .where(eq(anchorOutbox.id, id));
}

/**
 * Update heartbeat to maintain lease on processing job.
 */
export async function updateHeartbeat(id: string): Promise<void> {
  await db
    .update(anchorOutbox)
    .set({ heartbeatAt: new Date() })
    .where(eq(anchorOutbox.id, id));
}

/**
 * Mark event as completed and create receipt.
 */
export async function markCompleted(
  id: string, 
  idempotencyKey: string,
  txHash?: string
): Promise<void> {
  await db.insert(anchorReceipts).values({
    idempotencyKey,
    outboxId: id,
    txHash,
    status: 'submitted',
  }).onConflictDoNothing();
  
  await db
    .update(anchorOutbox)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(anchorOutbox.id, id));
  
  rootLogger.info('[Outbox] Event completed', { id, txHash });
}

/**
 * Mark event as failed with error details.
 */
export async function markFailed(id: string, error: string): Promise<void> {
  const [event] = await db
    .select()
    .from(anchorOutbox)
    .where(eq(anchorOutbox.id, id))
    .limit(1);
  
  if (!event) return;
  
  const newRetryCount = event.retryCount + 1;
  const newStatus = newRetryCount >= MAX_RETRIES ? 'dead_letter' : 'failed';
  
  await db
    .update(anchorOutbox)
    .set({ 
      status: newStatus, 
      retryCount: newRetryCount,
      lastError: error,
      updatedAt: new Date() 
    })
    .where(eq(anchorOutbox.id, id));
  
  if (newStatus === 'dead_letter') {
    rootLogger.error('[Outbox] Event moved to dead letter', { id, retryCount: newRetryCount });
  }
}

/**
 * Get pending events for processing.
 */
export async function getPendingEvents(limit: number = 100): Promise<Array<{
  id: string;
  type: string;
  appId: string;
  digest: string;
  payload: Record<string, unknown>;
}>> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD);
  
  const events = await db
    .select()
    .from(anchorOutbox)
    .where(
      or(
        eq(anchorOutbox.status, 'pending'),
        eq(anchorOutbox.status, 'enqueued'),
        eq(anchorOutbox.status, 'failed'),
        and(
          eq(anchorOutbox.status, 'processing'),
          or(
            isNull(anchorOutbox.heartbeatAt),
            lt(anchorOutbox.heartbeatAt, staleThreshold)
          )
        )
      )
    )
    .limit(limit);
  
  return events.map((e: AnchorOutbox) => ({
    id: e.id,
    type: e.type,
    appId: e.appId,
    digest: e.digest,
    payload: e.payload as Record<string, unknown>,
  }));
}

/**
 * Reconciliation job - finds orphaned/stale events and re-enqueues them.
 * Run this on worker startup and periodically.
 */
export async function reconcileOrphaned(): Promise<{ recovered: number }> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD);
  
  const staleEvents = await db
    .select()
    .from(anchorOutbox)
    .where(
      and(
        eq(anchorOutbox.status, 'processing'),
        lt(anchorOutbox.heartbeatAt, staleThreshold)
      )
    );
  
  let recovered = 0;
  
  for (const event of staleEvents) {
    await db
      .update(anchorOutbox)
      .set({ 
        status: 'pending', 
        updatedAt: new Date(),
        heartbeatAt: null 
      })
      .where(eq(anchorOutbox.id, event.id));
    
    rootLogger.warn('[Outbox] Recovered stale event', { id: event.id, type: event.type });
    recovered++;
  }
  
  if (recovered > 0) {
    rootLogger.info('[Outbox] Reconciliation complete', { recovered });
  }
  
  return { recovered };
}

/**
 * Update receipt status to confirmed after on-chain confirmation.
 */
export async function confirmReceipt(
  idempotencyKey: string, 
  blockNumber: number
): Promise<void> {
  await db
    .update(anchorReceipts)
    .set({ 
      status: 'confirmed', 
      blockNumber,
      confirmedAt: new Date() 
    })
    .where(eq(anchorReceipts.idempotencyKey, idempotencyKey));
  
  rootLogger.info('[Outbox] Receipt confirmed', { idempotencyKey, blockNumber });
}

/**
 * Get pending receipts for confirmation polling.
 */
export async function getPendingReceipts(): Promise<Array<{
  idempotencyKey: string;
  txHash: string | null;
  outboxId: string | null;
}>> {
  const receipts = await db
    .select()
    .from(anchorReceipts)
    .where(eq(anchorReceipts.status, 'submitted'));
  
  return receipts.map((r: AnchorReceipt) => ({
    idempotencyKey: r.idempotencyKey,
    txHash: r.txHash,
    outboxId: r.outboxId,
  }));
}

/**
 * Get dead letter events for manual review.
 */
export async function getDeadLetterEvents(): Promise<Array<{
  id: string;
  type: string;
  appId: string;
  lastError: string | null;
  retryCount: number;
  createdAt: Date;
}>> {
  const events = await db
    .select()
    .from(anchorOutbox)
    .where(eq(anchorOutbox.status, 'dead_letter'));
  
  return events.map((e: AnchorOutbox) => ({
    id: e.id,
    type: e.type,
    appId: e.appId,
    lastError: e.lastError,
    retryCount: e.retryCount,
    createdAt: e.createdAt,
  }));
}

/**
 * Retry a dead letter event.
 */
export async function retryDeadLetter(id: string): Promise<void> {
  await db
    .update(anchorOutbox)
    .set({ 
      status: 'pending', 
      retryCount: 0,
      lastError: null,
      updatedAt: new Date() 
    })
    .where(eq(anchorOutbox.id, id));
  
  rootLogger.info('[Outbox] Dead letter event retried', { id });
}

export const outbox = {
  write: writeOutbox,
  markEnqueued,
  markProcessing,
  markCompleted,
  markFailed,
  updateHeartbeat,
  getPending: getPendingEvents,
  reconcile: reconcileOrphaned,
  confirmReceipt,
  getPendingReceipts,
  getDeadLetter: getDeadLetterEvents,
  retryDeadLetter,
};
