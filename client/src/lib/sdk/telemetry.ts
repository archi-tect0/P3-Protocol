import { getAnchors } from "./anchors";
import { getTicket } from "./bridge";
import type { TelemetryEvent } from "./types";

const eventQueue: TelemetryEvent[] = [];
let flushInterval: ReturnType<typeof setInterval> | null = null;

export function emit(type: string, data: Record<string, unknown>): void {
  const anchors = getAnchors();
  const ticket = getTicket();
  
  const event: TelemetryEvent = {
    type,
    data,
    anchorsHash: anchors.codehash,
    ticketId: ticket?.id,
    timestamp: Date.now()
  };
  
  eventQueue.push(event);
  
  if (eventQueue.length >= 10) {
    flush();
  }
}

export async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;
  
  const events = [...eventQueue];
  eventQueue.length = 0;
  
  try {
    await fetch('/api/telemetry/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events })
    });
  } catch (e) {
    console.warn('[P3 SDK] Telemetry flush failed:', e);
    eventQueue.push(...events);
  }
}

export function startAutoFlush(intervalMs = 30000): void {
  if (flushInterval) return;
  flushInterval = setInterval(flush, intervalMs);
}

export function stopAutoFlush(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

export function getQueueSize(): number {
  return eventQueue.length;
}

// Track common events
export const track = {
  walletConnect: (address: string) => emit('wallet_connect', { address }),
  walletDisconnect: () => emit('wallet_disconnect', {}),
  payment: (txHash: string, amount: string) => emit('payment', { txHash, amount }),
  message: (cid?: string) => emit('message', { cid }),
  proofPublish: (cid: string, type: string) => emit('proof_publish', { cid, type }),
  error: (code: string, message: string) => emit('error', { code, message })
};
