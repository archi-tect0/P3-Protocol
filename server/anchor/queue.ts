/**
 * Anchor Queue with Durable Outbox Pattern
 * 
 * Implements crash recovery with:
 * - Persist-before-enqueue for durability
 * - Idempotency keys for exactly-once writes
 * - Transactional enqueue with compensation
 * - Heartbeat + lease for worker coordination
 * - Dead letter queue for terminal failures
 */

import { Queue, Worker, Job } from 'bullmq';
import { flags } from '../config/flags';
import { rootLogger } from '../observability/logger';
import { outbox, OutboxEvent } from './outbox';

const REGION = process.env.REGION || 'us';
const connection = { host: process.env.REDIS_HOST || 'localhost', port: 6379 };
const HEARTBEAT_INTERVAL = 15000; // 15 seconds

let anchorQueueInstance: Queue | null = null;
let workerInstance: Worker | null = null;
let reconcileInterval: NodeJS.Timeout | null = null;

export interface AnchorEvent {
  appId: string;
  event: string;
  data?: Record<string, unknown>;
  ts?: number;
  idempotencyKey?: string;
}

function getQueue(): Queue | null {
  if (!flags.anchorQueue) {
    return null;
  }
  if (!anchorQueueInstance) {
    try {
      anchorQueueInstance = new Queue(`anchor:${REGION}`, { connection });
    } catch (err) {
      rootLogger.error('[AnchorQueue] Failed to create queue', { error: err });
      return null;
    }
  }
  return anchorQueueInstance;
}

/**
 * Enqueue anchors with durable outbox pattern.
 * Persists to database first, then enqueues to BullMQ.
 */
export async function enqueueAnchors(events: AnchorEvent[]): Promise<{ queued: boolean; count: number; ids: string[] }> {
  const ids: string[] = [];
  
  for (const event of events) {
    try {
      const outboxEvent: OutboxEvent = {
        type: event.event,
        appId: event.appId,
        payload: {
          event: event.event,
          ts: event.ts || Date.now(),
          ...event.data,
        },
        idempotencyKey: event.idempotencyKey,
      };
      
      const { id, digest, idempotencyKey } = await outbox.write(outboxEvent);
      ids.push(id);
      
      const queue = getQueue();
      if (queue) {
        try {
          await queue.add('anchor', { id, digest, idempotencyKey }, {
            jobId: `${id}:${digest}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 800 },
            removeOnComplete: true,
            removeOnFail: false,
          });
          await outbox.markEnqueued(id);
        } catch (enqueueErr) {
          rootLogger.warn('[AnchorQueue] Failed to enqueue, will be picked up by reconciliation', { 
            id, 
            error: enqueueErr 
          });
        }
      }
    } catch (err) {
      rootLogger.error('[AnchorQueue] Failed to write outbox event', { error: err });
    }
  }
  
  return { queued: !!getQueue(), count: events.length, ids };
}

/**
 * Process a single outbox event.
 */
async function processOutboxEvent(
  id: string, 
  digest: string, 
  idempotencyKey: string
): Promise<void> {
  await outbox.markProcessing(id);
  
  const heartbeatTimer = setInterval(async () => {
    try {
      await outbox.updateHeartbeat(id);
    } catch (err) {
      rootLogger.warn('[AnchorQueue] Heartbeat update failed', { id });
    }
  }, HEARTBEAT_INTERVAL);
  
  try {
    const { indexAnchorEvent } = await import('../explorer/index');
    const events = await outbox.getPending(1);
    const event = events.find(e => e.id === id);
    
    if (!event) {
      rootLogger.warn('[AnchorQueue] Event not found in outbox', { id });
      return;
    }
    
    const eventId = `${event.appId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    await indexAnchorEvent(
      event.appId,
      eventId,
      (event.payload as any).ts || Date.now(),
      event.payload
    );
    
    await outbox.markCompleted(id, idempotencyKey, eventId);
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await outbox.markFailed(id, errorMessage);
    throw err;
  } finally {
    clearInterval(heartbeatTimer);
  }
}

/**
 * Start the anchor worker with crash recovery.
 */
export function startAnchorWorker(handler?: (events: AnchorEvent[]) => Promise<void>): Worker | null {
  if (!flags.anchorQueue) {
    rootLogger.info('[AnchorWorker] Queue disabled, starting reconciliation-only mode');
    startReconciliation();
    return null;
  }
  
  try {
    outbox.reconcile().then(({ recovered }) => {
      if (recovered > 0) {
        rootLogger.info('[AnchorWorker] Startup reconciliation complete', { recovered });
      }
    });
    
    workerInstance = new Worker(`anchor:${REGION}`, async (job: Job) => {
      const { id, digest, idempotencyKey } = job.data;
      
      try {
        await processOutboxEvent(id, digest, idempotencyKey);
        
        if (handler) {
          const events = await outbox.getPending(1);
          const event = events.find(e => e.id === id);
          if (event) {
            await handler([{
              appId: event.appId,
              event: event.type,
              data: event.payload,
            }]);
          }
        }
      } catch (err) {
        rootLogger.error('[AnchorWorker] Job processing failed', { 
          id, 
          error: err,
          attempt: job.attemptsMade 
        });
        throw err;
      }
    }, { 
      connection, 
      concurrency: parseInt(process.env.ANCHOR_CONCURRENCY || '64', 10),
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });
    
    workerInstance.on('failed', (job, err) => {
      if (job) {
        rootLogger.error('[AnchorWorker] Job failed permanently', { 
          jobId: job.id, 
          attempts: job.attemptsMade,
          error: err.message 
        });
      }
    });
    
    startReconciliation();
    
    rootLogger.info('[AnchorWorker] Started with crash recovery enabled');
    return workerInstance;
    
  } catch (err) {
    rootLogger.error('[AnchorWorker] Failed to start worker', { error: err });
    startReconciliation();
    return null;
  }
}

/**
 * Start periodic reconciliation for orphaned events.
 */
function startReconciliation(): void {
  if (reconcileInterval) return;
  
  reconcileInterval = setInterval(async () => {
    try {
      const { recovered } = await outbox.reconcile();
      if (recovered > 0) {
        rootLogger.info('[AnchorQueue] Periodic reconciliation recovered events', { recovered });
        
        const pending = await outbox.getPending(100);
        const queue = getQueue();
        
        for (const event of pending) {
          if (queue) {
            try {
              const idempotencyKey = `${event.appId}:${event.type}:${event.digest}`;
              await queue.add('anchor', { 
                id: event.id, 
                digest: event.digest, 
                idempotencyKey 
              }, {
                jobId: `${event.id}:${event.digest}`,
                attempts: 5,
                backoff: { type: 'exponential', delay: 800 },
              });
              await outbox.markEnqueued(event.id);
            } catch (err) {
              rootLogger.debug('[AnchorQueue] Event already enqueued or failed', { id: event.id });
            }
          } else {
            await processOutboxEvent(event.id, event.digest, `${event.appId}:${event.type}:${event.digest}`);
          }
        }
      }
    } catch (err) {
      rootLogger.error('[AnchorQueue] Reconciliation failed', { error: err });
    }
  }, 60000); // Every minute
}

/**
 * Stop the worker and reconciliation.
 */
export async function stopAnchorWorker(): Promise<void> {
  if (reconcileInterval) {
    clearInterval(reconcileInterval);
    reconcileInterval = null;
  }
  
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  
  if (anchorQueueInstance) {
    await anchorQueueInstance.close();
    anchorQueueInstance = null;
  }
  
  rootLogger.info('[AnchorWorker] Stopped');
}

/**
 * Get queue metrics for observability.
 */
export async function getQueueMetrics(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  deadLetter: number;
}> {
  const queue = getQueue();
  
  if (!queue) {
    const deadLetter = await outbox.getDeadLetter();
    return { waiting: 0, active: 0, completed: 0, failed: 0, deadLetter: deadLetter.length };
  }
  
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  
  const deadLetter = await outbox.getDeadLetter();
  
  return { waiting, active, completed, failed, deadLetter: deadLetter.length };
}

export const anchorQueue = { 
  enqueue: enqueueAnchors,
  startWorker: startAnchorWorker,
  stopWorker: stopAnchorWorker,
  getMetrics: getQueueMetrics,
  outbox,
};
