import Redis, { Cluster, RedisOptions, ClusterOptions } from 'ioredis';
import { flags } from '../config/flags';

const REGION_PREFIX = process.env.REGION_PREFIX || 'us-east-1';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const retryStrategy = (times: number): number | null => {
  if (times > 10) {
    console.error('[Redis] Max retries reached, giving up');
    return null;
  }
  const delay = Math.min(times * 100, 3000);
  console.log(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`);
  return delay;
};

const baseOptions: RedisOptions = {
  retryStrategy,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  connectTimeout: 10000,
  commandTimeout: 5000,
};

let redisClient: Redis | Cluster | null = null;

function createStandaloneClient(): Redis {
  const client = new Redis(REDIS_URL, baseOptions);

  client.on('connect', () => {
    console.log('[Redis] Connected to standalone server');
  });

  client.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
  });

  return client;
}

function createClusterClient(): Cluster {
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
    redisOptions: baseOptions,
    enableReadyCheck: true,
    scaleReads: 'slave',
  };

  const cluster = new Redis.Cluster(clusterNodes, clusterOptions);

  cluster.on('connect', () => {
    console.log('[Redis] Connected to cluster');
  });

  cluster.on('error', (err) => {
    console.error('[Redis] Cluster error:', err.message);
  });

  cluster.on('node error', (err, address) => {
    console.error(`[Redis] Node error at ${address}:`, err.message);
  });

  return cluster;
}

export function getRedisClient(): Redis | Cluster {
  if (!redisClient) {
    if (flags.redisCluster) {
      redisClient = createClusterClient();
    } else {
      redisClient = createStandaloneClient();
    }
  }
  return redisClient;
}

export const getRedis = getRedisClient;

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status === 'wait' || client.status === 'close') {
    await client.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

function prefixKey(key: string): string {
  return `${REGION_PREFIX}:${key}`;
}

export function keyAnchor(anchorId: string): string {
  return prefixKey(`anchor:${anchorId}`);
}

export function keyExplorer(explorerId: string): string {
  return prefixKey(`explorer:${explorerId}`);
}

export function keySession(sessionId: string): string {
  return prefixKey(`session:${sessionId}`);
}

export async function setWithExpiry(
  key: string,
  value: string,
  expirySeconds: number
): Promise<void> {
  const client = getRedisClient();
  await client.set(key, value, 'EX', expirySeconds);
}

export async function get(key: string): Promise<string | null> {
  const client = getRedisClient();
  return client.get(key);
}

export async function del(key: string): Promise<number> {
  const client = getRedisClient();
  return client.del(key);
}

export async function exists(key: string): Promise<boolean> {
  const client = getRedisClient();
  const result = await client.exists(key);
  return result === 1;
}

export default {
  getRedisClient,
  getRedis,
  connectRedis,
  disconnectRedis,
  keyAnchor,
  keyExplorer,
  keySession,
  setWithExpiry,
  get,
  del,
  exists,
};
