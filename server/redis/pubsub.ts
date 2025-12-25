import Redis from 'ioredis';
import { flags } from '../config/flags';

const REGION_PREFIX = process.env.REGION_PREFIX || 'us-east-1';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NUM_SHARDS = parseInt(process.env.REDIS_SHARD_COUNT || '8', 10);

type MessageHandler = (channel: string, message: string) => void;

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
const handlers: Set<MessageHandler> = new Set();

const retryStrategy = (times: number): number | null => {
  if (times > 10) {
    console.error('[RedisPubSub] Max retries reached');
    return null;
  }
  return Math.min(times * 100, 3000);
};

function createClient(): Redis {
  const client = new Redis(REDIS_URL, {
    retryStrategy,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 10000,
  });

  client.on('error', (err) => {
    console.error('[RedisPubSub] Connection error:', err.message);
  });

  return client;
}

function hashRoomToShard(roomId: string): number {
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    const char = roomId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % NUM_SHARDS;
}

function getShardChannel(shardIndex: number): string {
  return `${REGION_PREFIX}:signal:shard:${shardIndex}`;
}

function getRoomChannel(roomId: string): string {
  const shardIndex = hashRoomToShard(roomId);
  return getShardChannel(shardIndex);
}

export function shard(roomId: string): number {
  return hashRoomToShard(roomId);
}

export async function publish(roomId: string, payload: unknown): Promise<void> {
  if (!publisher) {
    publisher = createClient();
    await publisher.connect();
  }

  const channel = getRoomChannel(roomId);
  const message = JSON.stringify({
    roomId,
    payload,
    timestamp: Date.now(),
  });

  try {
    await publisher.publish(channel, message);
  } catch (err) {
    console.error('[RedisPubSub] Publish error:', err);
    throw err;
  }
}

export async function subscribe(handler: MessageHandler): Promise<void> {
  if (!subscriber) {
    subscriber = createClient();
    await subscriber.connect();

    subscriber.on('message', (channel: string, message: string) => {
      handlers.forEach((h) => {
        try {
          h(channel, message);
        } catch (err) {
          console.error('[RedisPubSub] Handler error:', err);
        }
      });
    });

    const channels = Array.from({ length: NUM_SHARDS }, (_, i) =>
      getShardChannel(i)
    );

    await subscriber.subscribe(...channels);
    console.log(`[RedisPubSub] Subscribed to ${NUM_SHARDS} shard channels`);
  }

  handlers.add(handler);
}

export function unsubscribe(handler: MessageHandler): void {
  handlers.delete(handler);
}

export async function disconnect(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
  handlers.clear();
}

export default {
  shard,
  publish,
  subscribe,
  unsubscribe,
  disconnect,
};
