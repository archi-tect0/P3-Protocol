type Listener = (data: unknown) => void;

interface BufferedEvent {
  data: unknown;
  timestamp: number;
}

const EVENT_BUFFER_TTL_MS = 60_000;
const MAX_BUFFER_SIZE = 100;

class FlowEventBus {
  private listeners = new Map<string, Set<Listener>>();
  private eventBuffer = new Map<string, BufferedEvent[]>();

  subscribe(flowId: string, listener: Listener, replay = true): void {
    if (!this.listeners.has(flowId)) {
      this.listeners.set(flowId, new Set());
    }
    this.listeners.get(flowId)!.add(listener);

    if (replay) {
      const buffered = this.eventBuffer.get(flowId);
      if (buffered) {
        for (const event of buffered) {
          try {
            listener(event.data);
          } catch (e) {
            console.error('[FlowEventBus] Replay listener error:', e);
          }
        }
      }
    }
  }

  unsubscribe(flowId: string, listener: Listener): void {
    const set = this.listeners.get(flowId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(flowId);
      }
    }
  }

  emit(flowId: string, data: unknown): void {
    this.bufferEvent(flowId, data);

    const set = this.listeners.get(flowId);
    if (set) {
      for (const listener of set) {
        try {
          listener(data);
        } catch (e) {
          console.error('[FlowEventBus] Listener error:', e);
        }
      }
    }
  }

  private bufferEvent(flowId: string, data: unknown): void {
    if (!this.eventBuffer.has(flowId)) {
      this.eventBuffer.set(flowId, []);
    }

    const buffer = this.eventBuffer.get(flowId)!;
    buffer.push({ data, timestamp: Date.now() });

    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift();
    }

    this.cleanExpiredBuffers();
  }

  private cleanExpiredBuffers(): void {
    const now = Date.now();
    for (const [flowId, buffer] of this.eventBuffer.entries()) {
      const filtered = buffer.filter(e => now - e.timestamp < EVENT_BUFFER_TTL_MS);
      if (filtered.length === 0) {
        this.eventBuffer.delete(flowId);
      } else {
        this.eventBuffer.set(flowId, filtered);
      }
    }
  }

  getBufferedEvents(flowId: string): unknown[] {
    return (this.eventBuffer.get(flowId) || []).map(e => e.data);
  }

  hasListeners(flowId: string): boolean {
    return (this.listeners.get(flowId)?.size ?? 0) > 0;
  }

  getActiveFlowIds(): string[] {
    return Array.from(this.listeners.keys());
  }

  getBufferedFlowIds(): string[] {
    return Array.from(this.eventBuffer.keys());
  }
}

export const flowEventBus = new FlowEventBus();
