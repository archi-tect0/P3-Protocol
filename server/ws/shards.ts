import { flags } from '../config/flags';

const DEFAULT_SHARD_COUNT = 8;

let shardCountCached: number | null = null;

export function getShardCount(): number {
  if (shardCountCached !== null) {
    return shardCountCached;
  }
  
  if (flags.wsShards) {
    const envShardCount = process.env.WS_SHARD_COUNT;
    shardCountCached = envShardCount ? parseInt(envShardCount, 10) : DEFAULT_SHARD_COUNT;
  } else {
    shardCountCached = 1;
  }
  
  return shardCountCached;
}

export function chooseShard(key: string): number {
  const shardCount = getShardCount();
  
  if (shardCount === 1) {
    return 0;
  }
  
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash) % shardCount;
}

export function getShardChannel(shardIndex: number): string {
  const region = process.env.REGION_PREFIX || 'us-east-1';
  return `${region}:ws:shard:${shardIndex}`;
}

export function getShardChannelForKey(key: string): string {
  const shardIndex = chooseShard(key);
  return getShardChannel(shardIndex);
}

export function getAllShardChannels(): string[] {
  const shardCount = getShardCount();
  return Array.from({ length: shardCount }, (_, i) => getShardChannel(i));
}

export function resetShardCache(): void {
  shardCountCached = null;
}

export default {
  getShardCount,
  chooseShard,
  getShardChannel,
  getShardChannelForKey,
  getAllShardChannels,
  resetShardCache,
};
