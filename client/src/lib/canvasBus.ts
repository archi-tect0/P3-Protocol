export type Receipt = {
  id: string;
  artifactId: string;
  op: string;
  prevHash?: string;
  nextHash: string;
  timestamp: string;
  actor: { walletAddress: string; sessionId: string };
  meta?: Record<string, unknown>;
  error?: { code: string; message: string };
};

export type BusEvent = { receipt: Receipt };
export type Handler = (e: BusEvent) => void;

class CanvasBus {
  private handlers: Set<Handler> = new Set();
  private recentReceipts: Receipt[] = [];
  private maxReceipts = 100;

  publish(event: BusEvent) {
    this.recentReceipts = [event.receipt, ...this.recentReceipts].slice(0, this.maxReceipts);
    this.handlers.forEach(h => {
      try {
        h(event);
      } catch (err) {
        console.error('[CanvasBus] Handler error:', err);
      }
    });
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  getRecent(limit = 50): Receipt[] {
    return this.recentReceipts.slice(0, limit);
  }

  getByArtifact(artifactId: string, limit = 50): Receipt[] {
    return this.recentReceipts
      .filter(r => r.artifactId === artifactId)
      .slice(0, limit);
  }

  clear() {
    this.recentReceipts = [];
  }

  get handlerCount(): number {
    return this.handlers.size;
  }
}

export const canvasBus = new CanvasBus();

export function publishReceipt(receipt: Receipt) {
  canvasBus.publish({ receipt });
}

export function subscribeToReceipts(handler: Handler): () => void {
  return canvasBus.subscribe(handler);
}
