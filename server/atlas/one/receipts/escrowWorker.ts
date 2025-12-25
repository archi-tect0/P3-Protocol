/**
 * Receipt Escrow Worker with BullMQ
 * 
 * Processes receipt anchoring jobs with high concurrency.
 * Uses guards to prevent duplicate initialization.
 */

import { Worker, Job } from 'bullmq';
import Redis, { Cluster, RedisOptions, ClusterOptions } from 'ioredis';
import { rootLogger } from '../../../observability/logger';
import { anchorReceipt } from './escrowService';
import type { EscrowJobData } from './escrowQueue';

const REGION = process.env.REGION || 'us';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const FLAG_REDIS_CLUSTER = process.env.FLAG_REDIS_CLUSTER === '1';
const WORKER_CONCURRENCY = parseInt(process.env.ESCROW_WORKER_CONCURRENCY || '32', 10);

let workerInstance: Worker | null = null;
let workerRedisConnection: Redis | Cluster | null = null;
let startGuard = false;

const retryStrategy = (times: number): number | null => {
  if (times > 10) {
    rootLogger.error('[EscrowWorker] Redis max retries reached');
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
      rootLogger.info('[EscrowWorker] Redis connected (cluster)');
    });

    cluster.on('error', (err) => {
      rootLogger.error('[EscrowWorker] Redis cluster error', err);
    });

    return cluster;
  }

  const client = new Redis(REDIS_URL, baseRedisOptions);

  client.on('connect', () => {
    rootLogger.info('[EscrowWorker] Redis connected (standalone)');
  });

  client.on('error', (err) => {
    rootLogger.error('[EscrowWorker] Redis error', err);
  });

  return client;
}

async function processEscrowJob(job: Job<EscrowJobData>): Promise<void> {
  const { receiptId, sessionId, itemId, action } = job.data;

  rootLogger.debug('[EscrowWorker] Processing job', {
    receiptId,
    sessionId,
    itemId,
    action,
    jobId: job.id,
  });

  try {
    const result = await anchorReceipt(job.data);

    if (!result.success) {
      throw new Error(result.error || 'Anchor failed');
    }

    rootLogger.info('[EscrowWorker] Job completed successfully', {
      receiptId,
      txHash: result.txHash,
      jobId: job.id,
    });
  } catch (err) {
    rootLogger.error('[EscrowWorker] Job processing failed', err instanceof Error ? err : new Error(String(err)), {
      receiptId,
      jobId: job.id,
    });
    throw err;
  }
}

export function startEscrowWorker(): Worker | null {
  if (workerInstance) {
    rootLogger.debug('[EscrowWorker] Worker already running, skipping start');
    return workerInstance;
  }

  if (startGuard) {
    rootLogger.warn('[EscrowWorker] Start already in progress, skipping');
    return null;
  }

  startGuard = true;

  try {
    workerRedisConnection = createWorkerConnection();

    workerInstance = new Worker<EscrowJobData>(
      `receipt-escrow:${REGION}`,
      processEscrowJob,
      {
        connection: workerRedisConnection,
        concurrency: WORKER_CONCURRENCY,
        removeOnComplete: { count: 2000 },
        removeOnFail: { count: 5000 },
        lockDuration: 30000,
        stalledInterval: 15000,
      }
    );

    workerInstance.on('completed', (job) => {
      rootLogger.debug('[EscrowWorker] Job completed', { jobId: job.id });
    });

    workerInstance.on('failed', (job, err) => {
      rootLogger.error('[EscrowWorker] Job failed', err, {
        jobId: job?.id,
        attempts: job?.attemptsMade,
      });
    });

    workerInstance.on('error', (err) => {
      rootLogger.error('[EscrowWorker] Worker error', err);
    });

    workerInstance.on('stalled', (jobId) => {
      rootLogger.warn('[EscrowWorker] Job stalled', { jobId });
    });

    rootLogger.info('[EscrowWorker] Started', {
      region: REGION,
      concurrency: WORKER_CONCURRENCY,
      cluster: FLAG_REDIS_CLUSTER,
    });

    return workerInstance;
  } catch (err) {
    rootLogger.error('[EscrowWorker] Failed to start', err instanceof Error ? err : new Error(String(err)));
    return null;
  } finally {
    startGuard = false;
  }
}

export async function stopEscrowWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    rootLogger.info('[EscrowWorker] Worker stopped');
  }

  if (workerRedisConnection) {
    await workerRedisConnection.quit();
    workerRedisConnection = null;
  }
}

export function getEscrowWorkerStatus(): {
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
