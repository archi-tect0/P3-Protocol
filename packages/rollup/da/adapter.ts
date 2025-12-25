import { ethers } from 'ethers';
import { EventEmitter } from 'events';

export interface BatchData {
  batchId: string;
  merkleRoot: string;
  events: any[];
  metadata: any;
}

export interface DAConfig {
  l2Provider: ethers.Provider;
  l2Signer: ethers.Signer;
  targetAddress?: string;
  enableBlobStorage: boolean;
  maxCalldataSize: number;
}

export class DataAvailabilityAdapter extends EventEmitter {
  private config: DAConfig;
  private submissionQueue: BatchData[] = [];
  private isProcessing: boolean = false;

  constructor(config: DAConfig) {
    super();
    this.config = {
      enableBlobStorage: false,
      maxCalldataSize: 128 * 1024,
      targetAddress: ethers.ZeroAddress,
      ...config,
    };
  }

  async submitBatch(batchData: BatchData): Promise<string> {
    this.submissionQueue.push(batchData);
    this.emit('batch:queued', batchData);
    
    if (!this.isProcessing) {
      return await this.processQueue();
    }
    
    return 'queued';
  }

  private async processQueue(): Promise<string> {
    if (this.isProcessing || this.submissionQueue.length === 0) {
      return 'idle';
    }

    this.isProcessing = true;
    let lastTxHash = '';

    try {
      while (this.submissionQueue.length > 0) {
        const batchData = this.submissionQueue.shift()!;
        lastTxHash = await this.writeBatchToL2(batchData);
      }
    } catch (error) {
      console.error('[DA] Error processing queue:', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
    }

    return lastTxHash;
  }

  private async writeBatchToL2(batchData: BatchData): Promise<string> {
    const compressed = this.compressBatchData(batchData);
    
    if (this.config.enableBlobStorage && compressed.length > this.config.maxCalldataSize) {
      return await this.writeToBlobStorage(compressed, batchData);
    } else {
      return await this.writeToCalldata(compressed, batchData);
    }
  }

  private async writeToCalldata(data: string, batchData: BatchData): Promise<string> {
    try {
      const tx = await this.config.l2Signer.sendTransaction({
        to: this.config.targetAddress,
        data: data,
        value: 0,
      });

      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`[DA] Batch ${batchData.batchId} written to L2 calldata. Tx: ${receipt.hash}`);
      this.emit('batch:submitted', {
        batchId: batchData.batchId,
        txHash: receipt.hash,
        method: 'calldata',
        size: data.length,
      });

      return receipt.hash;
    } catch (error) {
      console.error('[DA] Error writing to calldata:', error);
      throw error;
    }
  }

  private async writeToBlobStorage(data: string, batchData: BatchData): Promise<string> {
    try {
      const blobTx = await this.createBlobTransaction(data);
      const tx = await this.config.l2Signer.sendTransaction(blobTx);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`[DA] Batch ${batchData.batchId} written to blob storage. Tx: ${receipt.hash}`);
      this.emit('batch:submitted', {
        batchId: batchData.batchId,
        txHash: receipt.hash,
        method: 'blob',
        size: data.length,
      });

      return receipt.hash;
    } catch (error) {
      console.error('[DA] Error writing to blob storage:', error);
      throw error;
    }
  }

  private createBlobTransaction(data: string): ethers.TransactionRequest {
    const blob = this.createBlob(data);
    
    return {
      to: this.config.targetAddress,
      data: '0x',
      value: 0,
      type: 3,
      maxFeePerBlobGas: ethers.parseUnits('1', 'gwei'),
      blobVersionedHashes: [this.hashBlob(blob)],
    } as any;
  }

  private createBlob(data: string): Uint8Array {
    const dataBytes = ethers.getBytes(data);
    const blobSize = 128 * 1024;
    const blob = new Uint8Array(blobSize);
    blob.set(dataBytes, 0);
    return blob;
  }

  private hashBlob(blob: Uint8Array): string {
    return ethers.keccak256(blob);
  }

  private compressBatchData(batchData: BatchData): string {
    const jsonData = JSON.stringify({
      batchId: batchData.batchId,
      merkleRoot: batchData.merkleRoot,
      eventCount: batchData.events.length,
      events: batchData.events.map(e => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        userId: e.userId,
        dataHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(e.data))),
      })),
      metadata: batchData.metadata,
    });

    const bytes = ethers.toUtf8Bytes(jsonData);
    return ethers.hexlify(bytes);
  }

  async retrieveBatchData(txHash: string): Promise<BatchData | null> {
    try {
      const tx = await this.config.l2Provider.getTransaction(txHash);
      
      if (!tx || !tx.data) {
        return null;
      }

      const decompressed = this.decompressBatchData(tx.data);
      return decompressed;
    } catch (error) {
      console.error('[DA] Error retrieving batch data:', error);
      return null;
    }
  }

  private decompressBatchData(data: string): BatchData {
    const bytes = ethers.getBytes(data);
    const jsonData = ethers.toUtf8String(bytes);
    return JSON.parse(jsonData);
  }

  getStats(): {
    queueSize: number;
    isProcessing: boolean;
    blobStorageEnabled: boolean;
    maxCalldataSize: number;
  } {
    return {
      queueSize: this.submissionQueue.length,
      isProcessing: this.isProcessing,
      blobStorageEnabled: this.config.enableBlobStorage,
      maxCalldataSize: this.config.maxCalldataSize,
    };
  }
}
