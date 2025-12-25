const isProduction = process.env.NODE_ENV === 'production';

function parseFlagWithDefault(envValue: string | undefined, productionDefault: boolean): boolean {
  if (envValue === '1' || envValue === 'true') return true;
  if (envValue === '0' || envValue === 'false') return false;
  return isProduction ? productionDefault : false;
}

export const flags = {
  redisCluster: parseFlagWithDefault(process.env.FLAG_REDIS_CLUSTER, true),
  anchorQueue: parseFlagWithDefault(process.env.FLAG_ANCHOR_QUEUE, true),
  wsShards: parseFlagWithDefault(process.env.FLAG_WS_SHARDS, true),
  edgeCache: parseFlagWithDefault(process.env.FLAG_EDGE_CACHE, true),
  uploadsDirect: parseFlagWithDefault(process.env.FLAG_UPLOADS_DIRECT, false),
  multiTurn: parseFlagWithDefault(process.env.FLAG_MULTI_TURN, false),
  globalCdn: parseFlagWithDefault(process.env.FLAG_GLOBAL_CDN, true),
};

export function getFlag(name: keyof typeof flags): boolean {
  return flags[name];
}

export function getAllFlags(): typeof flags {
  return { ...flags };
}
