import { sdkReq } from './core';
import type { AnchorEvent, BatchResult } from './anchor';

const FLUSH_DELAY_MS = 400;
const MAX_BATCH_SIZE = 500;

let queue: AnchorEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_DELAY_MS);
}

export async function flush(): Promise<BatchResult | null> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (queue.length === 0) {
    return null;
  }

  const eventsToSend = queue.splice(0, MAX_BATCH_SIZE);
  
  try {
    const result = await sdkReq<BatchResult>('/api/sdk/anchor/batch', {
      method: 'POST',
      body: JSON.stringify({ events: eventsToSend, anchor: true }),
    });

    if (queue.length > 0) {
      scheduleFlush();
    }

    return result;
  } catch (err) {
    queue = [...eventsToSend, ...queue];
    throw err;
  }
}

export function anchor(event: AnchorEvent): void {
  queue.push({
    ...event,
    ts: event.ts ?? Date.now(),
  });

  if (queue.length >= MAX_BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

export function batch(events: AnchorEvent[]): void {
  const timestamped = events.map((e) => ({
    ...e,
    ts: e.ts ?? Date.now(),
  }));
  queue.push(...timestamped);

  if (queue.length >= MAX_BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

export function getQueueLength(): number {
  return queue.length;
}

export function clearQueue(): void {
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
