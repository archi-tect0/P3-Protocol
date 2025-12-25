import { sdkReq } from './core';

export type FeedItem = {
  id: string;
  eventId: string;
  appId: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
  wallet?: string;
  txHash?: string;
};

export type FeedResult = {
  items: FeedItem[];
  hasMore: boolean;
  cursor?: string;
};

export async function getFeed(
  topic: string,
  opts?: { limit?: number; since?: number; cursor?: string }
): Promise<FeedResult> {
  return sdkReq<FeedResult>('/api/sdk/explorer/feed', {
    method: 'POST',
    body: JSON.stringify({
      topic,
      limit: opts?.limit ?? 100,
      since: opts?.since,
      cursor: opts?.cursor,
    }),
  });
}

export async function getEvent(eventId: string): Promise<FeedItem | null> {
  return sdkReq<FeedItem | null>(`/api/sdk/explorer/event/${eventId}`, {
    method: 'GET',
  });
}

export async function search(query: string, opts?: { 
  appId?: string; 
  limit?: number 
}): Promise<FeedResult> {
  return sdkReq<FeedResult>('/api/sdk/explorer/search', {
    method: 'POST',
    body: JSON.stringify({ query, ...opts }),
  });
}

export async function stats(appId?: string): Promise<{ 
  totalEvents: number; 
  last24h: number; 
  topEvents: Array<{ event: string; count: number }> 
}> {
  return sdkReq<{ totalEvents: number; last24h: number; topEvents: Array<{ event: string; count: number }> }>(
    '/api/sdk/explorer/stats',
    {
      method: 'POST',
      body: JSON.stringify({ appId }),
    }
  );
}
