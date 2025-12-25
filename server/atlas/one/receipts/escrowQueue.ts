/**
 * Receipt Escrow Queue with BullMQ
 * 
 * Handles async receipt processing for blockchain anchoring.
 * Uses cluster-aware Redis connection following existing patterns.
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis, { Cluster, RedisOptions, ClusterOptions } from 'ioredis';
import { rootLogger } from '../../../observability/logger';

const REGION = process.env.REGION || 'us';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const FLAG_REDIS_CLUSTER = process.env.FLAG_REDIS_CLUSTER === '1';

let escrowQueue: Queue | null = null;
let redisConnection: Redis | Cluster | null = null;
let initGuard = false;

const retryStrategy = (times: number): number | null => {
  if (times > 10) {
    rootLogger.error('[EscrowQueue] Redis max retries reached');
    return null;
  }
  const delay = Math.min(times * 100, 3000);
  rootLogger.debug('[EscrowQueue] Redis retry', { attempt: times, delay });
  return delay;
};

const baseRedisOptions: RedisOptions = {
  retryStrategy,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

function createStandaloneConnection(): Redis {
  const client = new Redis(REDIS_URL, baseRedisOptions);

  client.on('connect', () => {
    rootLogger.info('[EscrowQueue] Redis connected (standalone)');
  });

  client.on('error', (err) => {
    rootLogger.error('[EscrowQueue] Redis error', err);
  });

  return client;
}

function createClusterConnection(): Cluster {
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
    rootLogger.info('[EscrowQueue] Redis connected (cluster)');
  });

  cluster.on('error', (err) => {
    rootLogger.error('[EscrowQueue] Redis cluster error', err);
  });

  return cluster;
}

function getRedisConnection(): Redis | Cluster {
  if (!redisConnection) {
    if (FLAG_REDIS_CLUSTER) {
      redisConnection = createClusterConnection();
    } else {
      redisConnection = createStandaloneConnection();
    }
  }
  return redisConnection;
}

export function getEscrowQueue(): Queue {
  if (!escrowQueue) {
    if (initGuard) {
      throw new Error('[EscrowQueue] Circular initialization detected');
    }
    initGuard = true;

    try {
      const connection = getRedisConnection();

      const queueOptions: QueueOptions = {
        connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 2000 },
          removeOnFail: { count: 5000 },
        },
      };

      // Use underscore instead of colon to avoid BullMQ naming issues
      escrowQueue = new Queue(`receipt-escrow_${REGION}`, queueOptions);

      rootLogger.info('[EscrowQueue] Queue initialized', { 
        region: REGION, 
        cluster: FLAG_REDIS_CLUSTER 
      });
    } finally {
      initGuard = false;
    }
  }

  return escrowQueue;
}

export async function closeEscrowQueue(): Promise<void> {
  if (escrowQueue) {
    await escrowQueue.close();
    escrowQueue = null;
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }

  rootLogger.info('[EscrowQueue] Queue closed');
}

export interface EscrowJobData {
  receiptId: number;
  sessionId: string;
  walletAddress?: string;
  itemId: string;
  itemType?: string;
  action: string;
  clientSignature?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  idempotencyKey?: string;
}

export interface EscrowBatchJobData {
  receipts: EscrowJobData[];
  batchId: string;
  createdAt: number;
}
