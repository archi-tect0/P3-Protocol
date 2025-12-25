/**
 * Anchor Worker with BullMQ
 * 
 * Processes bulk anchor events with 64 concurrency.
 * Uses guards to prevent duplicate initialization.
 */

import { Worker, Job } from 'bullmq';
import Redis, { Cluster, RedisOptions, ClusterOptions } from 'ioredis';
import { rootLogger } from '../observability/logger';
import { AnchorBatchJobData, AnchorEvent } from '../queues/anchorQueue';

const REGION = process.env.REGION || 'us';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const FLAG_REDIS_CLUSTER = process.env.FLAG_REDIS_CLUSTER === '1';
const WORKER_CONCURRENCY = parseInt(process.env.ANCHOR_WORKER_CONCURRENCY || '64', 10);

let workerInstance: Worker | null = null;
let workerRedisConnection: Redis | Cluster | null = null;
let startGuard = false;

const retryStrategy = (times: number): number | null => {
  if (times > 10) {
    rootLogger.error('[AnchorWorker] Redis max retries reached');
    return null;
  }
  return Math.min(times * 100, 3000);
};

const baseRedisOptions: RedisOptions = {
  retryStrategy,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

function createWorkerConnection(): Redis | Cluster {
  if (FLAG_REDIS_CLUSTER) {
    const clusterNodes = (process.env.REDIS_CLUSTER_NODES || '')
      .split(',')
      .filter(Boolean)
      .map((node) => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port || '6379', 10) };
      });

    if (clusterNodes.length === 0) {
      clusterNodes.push({ host: 'localhost', port: 6379 });
    }

    const clusterOptions: ClusterOptions = {
      clusterRetryStrategy: retryStrategy,
      redisOptions: baseRedisOptions,
      enableReadyCheck: true,
      scaleReads: 'slave',
    };

    const cluster = new Redis.Cluster(clusterNodes, clusterOptions);

    cluster.on('connect', () => {
      rootLogger.info('[AnchorWorker] Redis connected (cluster)');
    });

    cluster.on('error', (err) => {
      rootLogger.error('[AnchorWorker] Redis cluster error', err);
    });

    return cluster;
  }

  const client = new Redis(REDIS_URL, baseRedisOptions);

  client.on('connect', () => {
    rootLogger.info('[AnchorWorker] Redis connected (standalone)');
  });

  client.on('error', (err) => {
    rootLogger.error('[AnchorWorker] Redis error', err);
  });

  return client;
}

async function processAnchorBatch(job: Job<AnchorBatchJobData>): Promise<void> {
  const { events, batchId, wallet } = job.data;

  rootLogger.debug('[AnchorWorker] Processing batch', {
    batchId,
    eventCount: events.length,
    wallet: wallet?.slice(0, 10),
    jobId: job.id,
  });

  try {
    const { indexAnchorEvent } = await import('../explorer/index');

    for (const event of events) {
      const eventId = `${event.appId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timestamp = event.ts || Date.now();

      await indexAnchorEvent(
        event.appId,
        eventId,
        timestamp,
        {
          event: event.event,
          wallet: wallet || event.data?.wallet,
          ...event.data,
        }
      );
    }

    rootLogger.info('[AnchorWorker] Batch processed successfully', {
      batchId,
      eventCount: events.length,
      jobId: job.id,
    });
  } catch (err) {
    rootLogger.error('[AnchorWorker] Batch processing failed', err instanceof Error ? err : new Error(String(err)), {
      batchId,
      jobId: job.id,
    });
    throw err;
  }
}

export function startAnchorWorker(): Worker | null {
  if (workerInstance) {
    rootLogger.debug('[AnchorWorker] Worker already running, skipping start');
    return workerInstance;
  }

  if (startGuard) {
    rootLogger.warn('[AnchorWorker] Start already in progress, skipping');
    return null;
  }

  startGuard = true;

  try {
    workerRedisConnection = createWorkerConnection();

    workerInstance = new Worker<AnchorBatchJobData>(
      `anchor-batch:${REGION}`,
      processAnchorBatch,
      {
        connection: workerRedisConnection,
        concurrency: WORKER_CONCURRENCY,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        lockDuration: 30000,
        stalledInterval: 15000,
      }
    );

    workerInstance.on('completed', (job) => {
      rootLogger.debug('[AnchorWorker] Job completed', { jobId: job.id });
    });

    workerInstance.on('failed', (job, err) => {
      rootLogger.error('[AnchorWorker] Job failed', err, {
        jobId: job?.id,
        attempts: job?.attemptsMade,
      });
    });

    workerInstance.on('error', (err) => {
      rootLogger.error('[AnchorWorker] Worker error', err);
    });

    workerInstance.on('stalled', (jobId) => {
      rootLogger.warn('[AnchorWorker] Job stalled', { jobId });
    });

    rootLogger.info('[AnchorWorker] Started', {
      region: REGION,
      concurrency: WORKER_CONCURRENCY,
      cluster: FLAG_REDIS_CLUSTER,
    });

    return workerInstance;
  } catch (err) {
    rootLogger.error('[AnchorWorker] Failed to start', err instanceof Error ? err : new Error(String(err)));
    return null;
  } finally {
    startGuard = false;
  }
}

export async function stopAnchorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    rootLogger.info('[AnchorWorker] Worker stopped');
  }

  if (workerRedisConnection) {
    await workerRedisConnection.quit();
    workerRedisConnection = null;
  }
}

export function getWorkerStatus(): {
  running: boolean;
  concurrency: number;
  region: string;
} {
  return {
    running: !!workerInstance,
    concurrency: WORKER_CONCURRENCY,
    region: REGION,
  };
}
