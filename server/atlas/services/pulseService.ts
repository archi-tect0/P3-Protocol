import { WebSocket } from 'ws';
import type { NewsArticle } from './newsService';
import { trackContentServed } from '../streaming';

export interface PulseMetrics {
  totalArticlesFetched: number;
  articlesCachedByNodes: number;
  articlesRelayedByNodes: number;
  bandwidthReductionPercent: number;
  activeSubscribers: number;
  lastBroadcastTimestamp: number;
}

export interface PulseEvent {
  type: 'news:update' | 'metrics:update' | 'node:task:complete' | 'subscribed' | 'error';
  data: unknown;
  timestamp: number;
}

export interface NewsUpdatePayload {
  articles: NewsArticle[];
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

interface MetricEntry {
  timestamp: number;
  fetched: number;
  cached: number;
  relayed: number;
}

const ROLLING_WINDOW_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

class PulseService {
  private subscribers: Set<WebSocket> = new Set();
  private metricsWindow: MetricEntry[] = [];
  private lastBroadcastTimestamp: number = 0;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.pruneOldMetrics();
    }, CLEANUP_INTERVAL_MS);
  }

  private pruneOldMetrics(): void {
    const cutoff = Date.now() - ROLLING_WINDOW_MS;
    this.metricsWindow = this.metricsWindow.filter(entry => entry.timestamp > cutoff);
  }

  subscribe(socket: WebSocket): void {
    this.subscribers.add(socket);
    
    socket.on('close', () => {
      this.unsubscribe(socket);
    });

    socket.on('error', () => {
      this.unsubscribe(socket);
    });

    this.sendToSocket(socket, {
      type: 'subscribed',
      data: {
        message: 'Connected to Atlas Pulse stream',
        metrics: this.getMetrics(),
      },
      timestamp: Date.now(),
    });

    console.log(`[PulseService] New subscriber connected. Total: ${this.subscribers.size}`);
  }

  unsubscribe(socket: WebSocket): void {
    this.subscribers.delete(socket);
    console.log(`[PulseService] Subscriber disconnected. Total: ${this.subscribers.size}`);
  }

  broadcast(event: PulseEvent): void {
    const message = JSON.stringify(event);
    const messageBytes = Buffer.byteLength(message, 'utf8');
    const deadSockets: WebSocket[] = [];
    let sentCount = 0;

    this.subscribers.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
        sentCount++;
      } else {
        deadSockets.push(socket);
      }
    });

    deadSockets.forEach(socket => this.subscribers.delete(socket));

    // Track total bytes served to all subscribers
    if (sentCount > 0) {
      trackContentServed(messageBytes * sentCount);
    }

    this.lastBroadcastTimestamp = event.timestamp;
  }

  private sendToSocket(socket: WebSocket, event: PulseEvent): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }

  broadcastNewsUpdate(payload: NewsUpdatePayload): void {
    const articleCount = payload.articles.length;
    
    this.metricsWindow.push({
      timestamp: Date.now(),
      fetched: articleCount,
      cached: 0,
      relayed: 0,
    });

    this.broadcast({
      type: 'news:update',
      data: payload,
      timestamp: Date.now(),
    });

    this.broadcastMetricsUpdate();
  }

  handleNodeTaskComplete(payload: NodeTaskPayload): void {
    const now = Date.now();
    
    const entry: MetricEntry = {
      timestamp: now,
      fetched: 0,
      cached: payload.taskType === 'cache' ? payload.articleCount : 0,
      relayed: payload.taskType === 'relay' ? payload.articleCount : 0,
    };
    
    this.metricsWindow.push(entry);

    this.broadcast({
      type: 'node:task:complete',
      data: payload,
      timestamp: now,
    });

    this.broadcastMetricsUpdate();
  }

  broadcastMetricsUpdate(): void {
    this.broadcast({
      type: 'metrics:update',
      data: this.getMetrics(),
      timestamp: Date.now(),
    });
  }

  getMetrics(): PulseMetrics {
    this.pruneOldMetrics();

    let totalFetched = 0;
    let totalCached = 0;
    let totalRelayed = 0;

    for (const entry of this.metricsWindow) {
      totalFetched += entry.fetched;
      totalCached += entry.cached;
      totalRelayed += entry.relayed;
    }

    const bandwidthReductionPercent = totalFetched > 0
      ? Math.round((totalCached / totalFetched) * 100 * 10) / 10
      : 0;

    return {
      totalArticlesFetched: totalFetched,
      articlesCachedByNodes: totalCached,
      articlesRelayedByNodes: totalRelayed,
      bandwidthReductionPercent,
      activeSubscribers: this.subscribers.size,
      lastBroadcastTimestamp: this.lastBroadcastTimestamp,
    };
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.subscribers.forEach(socket => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Server shutting down');
      }
    });
    
    this.subscribers.clear();
    this.metricsWindow = [];
  }

  recordFetch(articleCount: number, source: string): void {
    this.metricsWindow.push({
      timestamp: Date.now(),
      fetched: articleCount,
      cached: 0,
      relayed: 0,
    });
  }

  recordCacheHit(articleCount: number): void {
    this.metricsWindow.push({
      timestamp: Date.now(),
      fetched: 0,
      cached: articleCount,
      relayed: 0,
    });
  }

  recordRelay(articleCount: number): void {
    this.metricsWindow.push({
      timestamp: Date.now(),
      fetched: 0,
      cached: 0,
      relayed: articleCount,
    });
  }
}

export const pulseService = new PulseService();

export function subscribeToPulse(socket: WebSocket): void {
  pulseService.subscribe(socket);
}

export function unsubscribeFromPulse(socket: WebSocket): void {
  pulseService.unsubscribe(socket);
}

export function broadcastPulseEvent(event: PulseEvent): void {
  pulseService.broadcast(event);
}

export function broadcastNewsUpdate(payload: NewsUpdatePayload): void {
  pulseService.broadcastNewsUpdate(payload);
}

export function handleNodeTaskComplete(payload: NodeTaskPayload): void {
  pulseService.handleNodeTaskComplete(payload);
}

export function getPulseMetrics(): PulseMetrics {
  return pulseService.getMetrics();
}

export function getActivePulseSubscribers(): number {
  return pulseService.getSubscriberCount();
}
