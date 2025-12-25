import { Request, Response, NextFunction } from 'express';
import type { IStorage } from '../storage';
import type { InsertApiRequestMetrics } from '@shared/schema';

interface MetricsBuffer {
  data: InsertApiRequestMetrics;
  timestamp: number;
}

const metricsBuffer: MetricsBuffer[] = [];
const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 100;

let storage: IStorage | null = null;
let flushIntervalId: NodeJS.Timeout | null = null;

function normalizeEndpoint(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/0x[0-9a-fA-F]{40}/g, '/:address')
    .replace(/\/\d+/g, '/:n')
    .split('?')[0];
}

function getRequestBodySize(req: Request): number | null {
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    return isNaN(size) ? null : size;
  }
  return null;
}

async function flushMetrics(): Promise<void> {
  if (!storage || metricsBuffer.length === 0) {
    return;
  }

  const toFlush = metricsBuffer.splice(0, metricsBuffer.length);
  
  for (const item of toFlush) {
    try {
      await storage.recordApiRequestMetrics(item.data);
    } catch (error) {
      console.error('[MetricsMiddleware] Failed to save metric:', error);
    }
  }
}

function scheduleFlush(): void {
  if (flushIntervalId) {
    return;
  }
  
  flushIntervalId = setInterval(() => {
    flushMetrics().catch((error) => {
      console.error('[MetricsMiddleware] Flush error:', error);
    });
  }, FLUSH_INTERVAL_MS);
}

function bufferMetric(data: InsertApiRequestMetrics): void {
  metricsBuffer.push({
    data,
    timestamp: Date.now(),
  });

  if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
    flushMetrics().catch((error) => {
      console.error('[MetricsMiddleware] Flush error on buffer full:', error);
    });
  }
}

export function initApiMetrics(storageInstance: IStorage): void {
  storage = storageInstance;
  scheduleFlush();
  console.log('✓ API metrics middleware initialized');
}

export function apiMetricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const endpoint = normalizeEndpoint(req.path);
  const method = req.method;
  const requestBytes = getRequestBodySize(req);
  const isAtlasApi = req.path.startsWith('/atlas');
  const sessionReused = req.headers['connection']?.toLowerCase() === 'keep-alive';

  let responseBytes: number | null = null;
  const originalWrite = res.write;
  const originalEnd = res.end;
  const chunks: Buffer[] = [];

  res.write = function (chunk: any, ...args: any[]): boolean {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      }
    }
    return (originalWrite as any).apply(res, [chunk, ...args]);
  };

  res.end = function (chunk?: any, ...args: any[]): Response {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      }
    }

    const latencyMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    responseBytes = chunks.reduce((acc, c) => acc + c.length, 0);
    if (responseBytes === 0) {
      const contentLength = res.getHeader('content-length');
      if (contentLength) {
        const parsed = parseInt(String(contentLength), 10);
        if (!isNaN(parsed)) {
          responseBytes = parsed;
        }
      }
    }

    const metricsData: InsertApiRequestMetrics = {
      endpoint,
      method,
      requestBytes,
      responseBytes,
      latencyMs,
      statusCode,
      isAtlasApi,
      sessionReused,
    };

    bufferMetric(metricsData);

    return (originalEnd as any).apply(res, [chunk, ...args]);
  };

  next();
}

export function stopApiMetrics(): void {
  if (flushIntervalId) {
    clearInterval(flushIntervalId);
    flushIntervalId = null;
  }
  flushMetrics().catch((error) => {
    console.error('[MetricsMiddleware] Final flush error:', error);
  });
}

export default {
  apiMetricsMiddleware,
  initApiMetrics,
  stopApiMetrics,
};
