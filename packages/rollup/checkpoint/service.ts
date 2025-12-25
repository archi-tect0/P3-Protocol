import { EventEmitter } from 'events';
import { ethers } from 'ethers';

export interface CheckpointData {
  l2Root: string;
  daoStateRoot: string;
  timestamp: number;
  batchCount: number;
  eventCount: number;
  metadata?: any;
}

export interface CheckpointConfig {
  l1Provider: ethers.Provider;
  l1Signer: ethers.Signer;
  checkpointRegistryAddress: string;
  checkpointRegistryABI: any[];
  checkpointInterval: number;
}

export class CheckpointService extends EventEmitter {
  private config: CheckpointConfig;
  private checkpointTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastCheckpointTime: number = 0;
  private checkpointCount: number = 0;
  private checkpointRegistry: ethers.Contract;

  constructor(config: CheckpointConfig) {
    super();
    this.config = {
      checkpointInterval: 60 * 60 * 1000,
      ...config,
    };
    this.checkpointRegistry = new ethers.Contract(
      this.config.checkpointRegistryAddress,
      this.config.checkpointRegistryABI,
      this.config.l1Signer
    );
  }

  start(): void {
    if (this.isRunning) {
      console.log('[Checkpoint] Service already running');
      return;
    }

    this.isRunning = true;
    console.log(`[Checkpoint] Starting with ${this.config.checkpointInterval / 1000 / 60}min interval`);
    this.scheduleNextCheckpoint();
    this.emit('started');
  }

  stop(): void {
    if (this.checkpointTimer) {
      clearTimeout(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    this.isRunning = false;
    console.log('[Checkpoint] Service stopped');
    this.emit('stopped');
  }

  private scheduleNextCheckpoint(): void {
    if (!this.isRunning) {
      return;
    }

    this.checkpointTimer = setTimeout(async () => {
      await this.createCheckpoint();
      this.scheduleNextCheckpoint();
    }, this.config.checkpointInterval);
  }

  async forceCheckpoint(checkpointData: CheckpointData): Promise<string> {
    return await this.submitCheckpoint(checkpointData);
  }

  private async createCheckpoint(): Promise<void> {
    try {
      const checkpointData = await this.gatherCheckpointData();
      const txHash = await this.submitCheckpoint(checkpointData);
      
      this.lastCheckpointTime = Date.now();
      this.checkpointCount++;
      
      console.log(`[Checkpoint] Created checkpoint #${this.checkpointCount}. Tx: ${txHash}`);
      this.emit('checkpoint:created', {
        checkpointNumber: this.checkpointCount,
        txHash,
        data: checkpointData,
      });
    } catch (error) {
      console.error('[Checkpoint] Error creating checkpoint:', error);
      this.emit('checkpoint:error', error);
    }
  }

  private async gatherCheckpointData(): Promise<CheckpointData> {
    const l2Root = await this.computeL2Root();
    const daoStateRoot = await this.computeDAOStateRoot();

    return {
      l2Root,
      daoStateRoot,
      timestamp: Date.now(),
      batchCount: 0,
      eventCount: 0,
      metadata: {
        checkpointNumber: this.checkpointCount + 1,
        previousCheckpoint: this.lastCheckpointTime,
      },
    };
  }

  private async computeL2Root(): Promise<string> {
    try {
      const l2Block = await this.config.l1Provider.getBlock('latest');
      if (!l2Block) {
        return ethers.ZeroHash;
      }
      return l2Block.hash || ethers.ZeroHash;
    } catch (error) {
      console.error('[Checkpoint] Error computing L2 root:', error);
      return ethers.ZeroHash;
    }
  }

  private async computeDAOStateRoot(): Promise<string> {
    return ethers.keccak256(
      ethers.toUtf8Bytes(
        JSON.stringify({
          timestamp: Date.now(),
          checkpointNumber: this.checkpointCount + 1,
        })
      )
    );
  }

  private async submitCheckpoint(data: CheckpointData): Promise<string> {
    try {
      const metadata = JSON.stringify({
        timestamp: data.timestamp,
        batchCount: data.batchCount,
        eventCount: data.eventCount,
        ...data.metadata,
      });

      const tx = await this.checkpointRegistry.submitCheckpoint(
        data.l2Root,
        data.daoStateRoot,
        metadata
      );

      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`[Checkpoint] Submitted checkpoint to L1. Tx: ${receipt.hash}`);
      this.emit('checkpoint:submitted', {
        txHash: receipt.hash,
        data,
      });

      return receipt.hash;
    } catch (error) {
      console.error('[Checkpoint] Error submitting checkpoint:', error);
      throw error;
    }
  }

  async verifyCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const checkpoint = await this.checkpointRegistry.getCheckpoint(checkpointId);
      return checkpoint.timestamp > 0;
    } catch (error) {
      console.error('[Checkpoint] Error verifying checkpoint:', error);
      return false;
    }
  }

  getStats(): {
    isRunning: boolean;
    checkpointCount: number;
    lastCheckpointTime: number;
    nextCheckpointIn: number;
    checkpointInterval: number;
  } {
    const now = Date.now();
    const elapsed = now - (this.lastCheckpointTime || now);
    const nextIn = Math.max(0, this.config.checkpointInterval - elapsed);

    return {
      isRunning: this.isRunning,
      checkpointCount: this.checkpointCount,
      lastCheckpointTime: this.lastCheckpointTime,
      nextCheckpointIn: nextIn,
      checkpointInterval: this.config.checkpointInterval,
    };
  }
}
