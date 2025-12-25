import { getRedis, keyAnchor } from '../redis/client';

const REGION = process.env.REGION || 'us';

const inMemoryFallback = new Map<string, { timestamp: number; data: any }>();

function getRedisClient() {
  try {
    return getRedis();
  } catch (err) {
    console.error('[Explorer] Redis unavailable:', err);
    return null;
  }
}

export async function indexAnchorEvent(appId: string, eventId: string, timestamp: number, data: Record<string, any>): Promise<boolean> {
  const redis = getRedisClient();
  
  if (!redis) {
    inMemoryFallback.set(eventId, { timestamp, data: { appId, eventId, ...data } });
    console.log('[Explorer] Using in-memory fallback for event:', eventId);
    return false;
  }
  
  const key = `explorer:${REGION}:${appId}`;
  const dataKey = keyAnchor(eventId);
  
  try {
    const pipeline = redis.pipeline();
    pipeline.zadd(key, timestamp, eventId);
    pipeline.hset(dataKey, {
      appId,
      eventId,
      timestamp: String(timestamp),
      data: JSON.stringify(data),
    });
    pipeline.expire(dataKey, 60 * 60 * 24 * 30);
    
    const results = await pipeline.exec();
    
    if (results?.some(([err]) => err)) {
      console.error('[Explorer] Pipeline partial failure:', results);
      inMemoryFallback.set(eventId, { timestamp, data: { appId, eventId, ...data } });
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Explorer] Failed to index event:', err);
    inMemoryFallback.set(eventId, { timestamp, data: { appId, eventId, ...data } });
    return false;
  }
}

export async function listEvents(appId: string, startTs: number, endTs: number, limit = 100): Promise<string[]> {
  const redis = getRedisClient();
  if (!redis) {
    const fallbackEvents = Array.from(inMemoryFallback.entries())
      .filter(([_, v]) => v.timestamp >= startTs && v.timestamp <= endTs)
      .slice(0, limit)
      .map(([id]) => id);
    return fallbackEvents;
  }
  
  try {
    const key = `explorer:${REGION}:${appId}`;
    return await redis.zrangebyscore(key, startTs, endTs, 'LIMIT', 0, limit);
  } catch (err) {
    console.error('[Explorer] listEvents failed:', err);
    return [];
  }
}

export async function listEventsReverse(appId: string, startTs: number, endTs: number, limit = 100): Promise<string[]> {
  const redis = getRedisClient();
  if (!redis) {
    const fallbackEvents = Array.from(inMemoryFallback.entries())
      .filter(([_, v]) => v.timestamp >= startTs && v.timestamp <= endTs)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, limit)
      .map(([id]) => id);
    return fallbackEvents;
  }
  
  try {
    const key = `explorer:${REGION}:${appId}`;
    return await redis.zrevrangebyscore(key, endTs, startTs, 'LIMIT', 0, limit);
  } catch (err) {
    console.error('[Explorer] listEventsReverse failed:', err);
    return [];
  }
}

export async function getEventData(eventId: string): Promise<Record<string, any> | null> {
  const fallback = inMemoryFallback.get(eventId);
  if (fallback) {
    return fallback.data;
  }
  
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }
  
  try {
    const key = keyAnchor(eventId);
    const data = await redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    return {
      ...data,
      data: data.data ? JSON.parse(data.data) : null,
      timestamp: data.timestamp ? parseInt(data.timestamp, 10) : 0,
    };
  } catch (err) {
    console.error('[Explorer] getEventData failed:', err);
    return null;
  }
}

export async function countEvents(appId: string, startTs?: number, endTs?: number): Promise<number> {
  const redis = getRedisClient();
  if (!redis) {
    if (startTs !== undefined && endTs !== undefined) {
      return Array.from(inMemoryFallback.values())
        .filter(v => v.timestamp >= startTs && v.timestamp <= endTs).length;
    }
    return inMemoryFallback.size;
  }
  
  try {
    const key = `explorer:${REGION}:${appId}`;
    if (startTs !== undefined && endTs !== undefined) {
      return await redis.zcount(key, startTs, endTs);
    }
    return await redis.zcard(key);
  } catch (err) {
    console.error('[Explorer] countEvents failed:', err);
    return 0;
  }
}

export async function getRecentEvents(appId: string, count = 10): Promise<Array<{ eventId: string; score: number }>> {
  const redis = getRedisClient();
  if (!redis) {
    return Array.from(inMemoryFallback.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, count)
      .map(([id, v]) => ({ eventId: id, score: v.timestamp }));
  }
  
  try {
    const key = `explorer:${REGION}:${appId}`;
    const results = await redis.zrevrange(key, 0, count - 1, 'WITHSCORES');
    
    const events: Array<{ eventId: string; score: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      events.push({
        eventId: results[i],
        score: parseFloat(results[i + 1]),
      });
    }
    return events;
  } catch (err) {
    console.error('[Explorer] getRecentEvents failed:', err);
    return [];
  }
}

export async function deleteEvent(appId: string, eventId: string): Promise<boolean> {
  inMemoryFallback.delete(eventId);
  
  const redis = getRedisClient();
  if (!redis) {
    return true;
  }
  
  try {
    const key = `explorer:${REGION}:${appId}`;
    const dataKey = keyAnchor(eventId);
    
    const [zremResult] = await Promise.all([
      redis.zrem(key, eventId),
      redis.del(dataKey),
    ]);
    
    return zremResult > 0;
  } catch (err) {
    console.error('[Explorer] deleteEvent failed:', err);
    return false;
  }
}

export async function getEventsByIds(eventIds: string[]): Promise<Array<Record<string, any> | null>> {
  try {
    const results = await Promise.all(eventIds.map(id => getEventData(id)));
    return results;
  } catch (err) {
    console.error('[Explorer] getEventsByIds failed:', err);
    return eventIds.map(() => null);
  }
}

export function getInMemoryFallbackCount(): number {
  return inMemoryFallback.size;
}
