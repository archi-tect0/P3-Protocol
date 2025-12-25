export interface PulseMetrics {
  totalArticlesFetched: number;
  articlesCachedByNodes: number;
  articlesRelayedByNodes: number;
  bandwidthReductionPercent: number;
  activeSubscribers: number;
  lastBroadcastTimestamp: number;
}

export interface PulseNewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  topic?: string;
}

export interface PulseEvent {
  type: 'news:update' | 'metrics:update' | 'node:task:complete' | 'subscribed' | 'error' | 'pong';
  data: unknown;
  timestamp: number;
}

export interface NewsUpdatePayload {
  articles: PulseNewsArticle[];
  source: string;
  fetchTimestamp: number;
  topic?: string;
}

export interface NodeTaskPayload {
  nodeId: string;
  taskType: 'cache' | 'relay';
  articleCount: number;
  bytesProcessed: number;
}

export interface PulseStatus {
  active: boolean;
  subscribers: number;
  lastBroadcast: number;
  metricsWindow: {
    totalFetched: number;
    cached: number;
    relayed: number;
    bandwidthReduction: string;
  };
}
