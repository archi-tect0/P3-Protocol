/**
 * Anchor Queue with BullMQ and cluster-aware Redis connection
 * 
 * Supports both standalone Redis and Redis Cluster mode
 * via FLAG_REDIS_CLUSTER environment variable.
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis, { Cluster, RedisOptions, ClusterOptions } from 'ioredis';
import { rootLogger } from '../observability/logger';

const REGION = process.env.REGION || 'us';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const FLAG_REDIS_CLUSTER = process.env.FLAG_REDIS_CLUSTER === '1';

let anchorQueue: Queue | null = null;
let redisConnection: Redis | Cluster | null = null;
let initGuard = false;

const retryStrategy = (times: number): number | null => {
  if (times > 10) {
    rootLogger.error('[AnchorQueue] Redis max retries reached');
    return null;
  }
  const delay = Math.min(times * 100, 3000);
  rootLogger.debug('[AnchorQueue] Redis retry', { attempt: times, delay });
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
    rootLogger.info('[AnchorQueue] Redis connected (standalone)');
  });

  client.on('error', (err) => {
    rootLogger.error('[AnchorQueue] Redis error', err);
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
    rootLogger.info('[AnchorQueue] Redis connected (cluster)');
  });

  cluster.on('error', (err) => {
    rootLogger.error('[AnchorQueue] Redis cluster error', err);
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

export function getAnchorQueue(): Queue {
  if (!anchorQueue) {
    if (initGuard) {
      throw new Error('[AnchorQueue] Circular initialization detected');
    }
    initGuard = true;

    try {
      const connection = getRedisConnection();

      const queueOptions: QueueOptions = {
        connection,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 800 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      };

      anchorQueue = new Queue(`anchor-batch:${REGION}`, queueOptions);

      rootLogger.info('[AnchorQueue] Queue initialized', { 
        region: REGION, 
        cluster: FLAG_REDIS_CLUSTER 
      });
    } finally {
      initGuard = false;
    }
  }

  return anchorQueue;
}

export async function closeAnchorQueue(): Promise<void> {
  if (anchorQueue) {
    await anchorQueue.close();
    anchorQueue = null;
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }

  rootLogger.info('[AnchorQueue] Queue closed');
}

export interface AnchorEvent {
  appId: string;
  event: string;
  data?: Record<string, unknown>;
  ts?: number;
  idempotencyKey?: string;
}

export interface AnchorBatchJobData {
  events: AnchorEvent[];
  batchId: string;
  wallet?: string;
  createdAt: number;
}
