import { EventEmitter } from 'events';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'ethereum-cryptography/keccak';
import { ethers } from 'ethers';

export interface AppEvent {
  id: string;
  type: 'message' | 'meeting' | 'payment' | 'consent';
  timestamp: number;
  userId: string;
  data: any;
  signature?: string;
}

export interface Batch {
  id: string;
  events: AppEvent[];
  merkleRoot: string;
  startTime: number;
  endTime: number;
  eventCount: number;
}

export interface SequencerConfig {
  batchInterval: number;
  maxBatchSize: number;
  anchorRegistryAddress: string;
  anchorRegistryABI: any[];
  provider: ethers.Provider;
  signer: ethers.Signer;
}

export class Sequencer extends EventEmitter {
  private eventQueue: AppEvent[] = [];
  private currentBatch: AppEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private config: SequencerConfig;
  private anchorRegistry: ethers.Contract;

  constructor(config: SequencerConfig) {
    super();
    this.config = {
      batchInterval: 30000,
      maxBatchSize: 1000,
      ...config,
    };
    this.anchorRegistry = new ethers.Contract(
      this.config.anchorRegistryAddress,
      this.config.anchorRegistryABI,
      this.config.signer
    );
  }

  start(): void {
    console.log(`[Sequencer] Starting with ${this.config.batchInterval}ms batch interval`);
    this.scheduleBatchCreation();
    this.emit('started');
  }

  stop(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    console.log('[Sequencer] Stopped');
    this.emit('stopped');
  }

  async addEvent(event: AppEvent): Promise<void> {
    this.eventQueue.push(event);
    this.emit('event:queued', event);

    if (this.eventQueue.length >= this.config.maxBatchSize) {
      await this.forceBatchCreation();
    }
  }

  private scheduleBatchCreation(): void {
    this.batchTimer = setTimeout(async () => {
      await this.createBatch();
      this.scheduleBatchCreation();
    }, this.config.batchInterval);
  }

  async forceBatchCreation(): Promise<Batch | null> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    const batch = await this.createBatch();
    this.scheduleBatchCreation();
    return batch;
  }

  private async createBatch(): Promise<Batch | null> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return null;
    }

    this.isProcessing = true;

    try {
      const events = this.eventQueue.splice(0, this.config.maxBatchSize);
      this.sortEvents(events);

      const batch = await this.assembleBatch(events);
      
      await this.postToAnchorRegistry(batch);

      this.emit('batch:created', batch);
      console.log(`[Sequencer] Created batch ${batch.id} with ${batch.eventCount} events`);

      return batch;
    } catch (error) {
      console.error('[Sequencer] Error creating batch:', error);
      this.emit('batch:error', error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  private sortEvents(events: AppEvent[]): void {
    events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.id.localeCompare(b.id);
    });
  }

  private async assembleBatch(events: AppEvent[]): Promise<Batch> {
    const merkleRoot = this.generateMerkleRoot(events);
    const startTime = events[0]?.timestamp || Date.now();
    const endTime = events[events.length - 1]?.timestamp || Date.now();

    return {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      events,
      merkleRoot,
      startTime,
      endTime,
      eventCount: events.length,
    };
  }

  private generateMerkleRoot(events: AppEvent[]): string {
    const leaves = events.map(event => {
      const eventData = JSON.stringify({
        id: event.id,
        type: event.type,
        timestamp: event.timestamp,
        userId: event.userId,
        data: event.data,
      });
      return Buffer.from(keccak256(Buffer.from(eventData)));
    });

    if (leaves.length === 0) {
      return ethers.ZeroHash;
    }

    const tree = new MerkleTree(leaves, (data: Buffer) => Buffer.from(keccak256(data)), {
      sortPairs: true,
    });

    const root = tree.getRoot();
    return '0x' + root.toString('hex');
  }

  private async postToAnchorRegistry(batch: Batch): Promise<void> {
    try {
      const metadata = JSON.stringify({
        batchId: batch.id,
        startTime: batch.startTime,
        endTime: batch.endTime,
      });

      const tx = await this.anchorRegistry.anchorBundle(
        batch.merkleRoot,
        batch.eventCount,
        metadata
      );

      const receipt = await tx.wait();
      
      console.log(`[Sequencer] Anchored batch ${batch.id} to registry. Tx: ${receipt.hash}`);
      this.emit('batch:anchored', { batch, txHash: receipt.hash });
    } catch (error) {
      console.error('[Sequencer] Error posting to anchor registry:', error);
      throw error;
    }
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    batchInterval: number;
    maxBatchSize: number;
  } {
    return {
      queueSize: this.eventQueue.length,
      isProcessing: this.isProcessing,
      batchInterval: this.config.batchInterval,
      maxBatchSize: this.config.maxBatchSize,
    };
  }
}
