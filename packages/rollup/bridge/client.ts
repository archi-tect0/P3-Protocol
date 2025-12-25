import { EventEmitter } from 'events';
import { ethers } from 'ethers';

export interface CrossChainReceipt {
  receiptId: string;
  sourceChain: string;
  targetChain: string;
  data: any;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface BridgeConfig {
  sourceProvider: ethers.Provider;
  targetProvider: ethers.Provider;
  sourceSigner: ethers.Signer;
  bridgeContractAddress: string;
  bridgeContractABI: any[];
  confirmationBlocks: number;
}

export class BridgeClient extends EventEmitter {
  private config: BridgeConfig;
  private bridgeContract: ethers.Contract;
  private pendingReceipts: Map<string, CrossChainReceipt> = new Map();
  private confirmationWatchers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: BridgeConfig) {
    super();
    this.config = {
      confirmationBlocks: 12,
      ...config,
    };
    this.bridgeContract = new ethers.Contract(
      this.config.bridgeContractAddress,
      this.config.bridgeContractABI,
      this.config.sourceSigner
    );
  }

  async relayReceipt(receipt: Omit<CrossChainReceipt, 'status' | 'timestamp'>): Promise<string> {
    const fullReceipt: CrossChainReceipt = {
      ...receipt,
      timestamp: Date.now(),
      status: 'pending',
    };

    try {
      const txHash = await this.emitCrossChainEvent(fullReceipt);
      
      this.pendingReceipts.set(receipt.receiptId, fullReceipt);
      this.startConfirmationTracking(receipt.receiptId, txHash);
      
      this.emit('receipt:relayed', {
        receiptId: receipt.receiptId,
        txHash,
      });

      return txHash;
    } catch (error) {
      console.error('[Bridge] Error relaying receipt:', error);
      fullReceipt.status = 'failed';
      this.emit('receipt:failed', {
        receiptId: receipt.receiptId,
        error,
      });
      throw error;
    }
  }

  private async emitCrossChainEvent(receipt: CrossChainReceipt): Promise<string> {
    try {
      const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'string', 'string', 'bytes', 'uint256'],
        [
          receipt.receiptId,
          receipt.sourceChain,
          receipt.targetChain,
          ethers.toUtf8Bytes(JSON.stringify(receipt.data)),
          receipt.timestamp,
        ]
      );

      const tx = await this.bridgeContract.emitCrossChainReceipt(
        receipt.receiptId,
        receipt.targetChain,
        encodedData
      );

      const txReceipt = await tx.wait();
      
      if (!txReceipt) {
        throw new Error('Transaction receipt is null');
      }

      console.log(`[Bridge] Emitted cross-chain receipt ${receipt.receiptId}. Tx: ${txReceipt.hash}`);
      
      return txReceipt.hash;
    } catch (error) {
      console.error('[Bridge] Error emitting cross-chain event:', error);
      throw error;
    }
  }

  private startConfirmationTracking(receiptId: string, txHash: string): void {
    const checkConfirmation = async () => {
      try {
        const tx = await this.config.targetProvider.getTransaction(txHash);
        
        if (!tx) {
          return;
        }

        const currentBlock = await this.config.targetProvider.getBlockNumber();
        const txBlock = tx.blockNumber || 0;
        const confirmations = currentBlock - txBlock;

        if (confirmations >= this.config.confirmationBlocks) {
          this.handleConfirmation(receiptId, txHash, confirmations);
        } else {
          const watcher = setTimeout(checkConfirmation, 15000);
          this.confirmationWatchers.set(receiptId, watcher);
        }
      } catch (error) {
        console.error('[Bridge] Error checking confirmation:', error);
        this.handleFailure(receiptId, error);
      }
    };

    const watcher = setTimeout(checkConfirmation, 15000);
    this.confirmationWatchers.set(receiptId, watcher);
  }

  private handleConfirmation(receiptId: string, txHash: string, confirmations: number): void {
    const receipt = this.pendingReceipts.get(receiptId);
    
    if (receipt) {
      receipt.status = 'confirmed';
      this.pendingReceipts.delete(receiptId);
    }

    const watcher = this.confirmationWatchers.get(receiptId);
    if (watcher) {
      clearTimeout(watcher);
      this.confirmationWatchers.delete(receiptId);
    }

    console.log(`[Bridge] Receipt ${receiptId} confirmed with ${confirmations} blocks`);
    this.emit('receipt:confirmed', {
      receiptId,
      txHash,
      confirmations,
    });
  }

  private handleFailure(receiptId: string, error: any): void {
    const receipt = this.pendingReceipts.get(receiptId);
    
    if (receipt) {
      receipt.status = 'failed';
      this.pendingReceipts.delete(receiptId);
    }

    const watcher = this.confirmationWatchers.get(receiptId);
    if (watcher) {
      clearTimeout(watcher);
      this.confirmationWatchers.delete(receiptId);
    }

    this.emit('receipt:failed', {
      receiptId,
      error,
    });
  }

  async getReceiptStatus(receiptId: string): Promise<CrossChainReceipt | null> {
    return this.pendingReceipts.get(receiptId) || null;
  }

  getPendingReceipts(): CrossChainReceipt[] {
    return Array.from(this.pendingReceipts.values());
  }

  cleanup(): void {
    for (const watcher of this.confirmationWatchers.values()) {
      clearTimeout(watcher);
    }
    this.confirmationWatchers.clear();
    this.pendingReceipts.clear();
  }

  getStats(): {
    pendingCount: number;
    confirmationBlocks: number;
    watchersActive: number;
  } {
    return {
      pendingCount: this.pendingReceipts.size,
      confirmationBlocks: this.config.confirmationBlocks,
      watchersActive: this.confirmationWatchers.size,
    };
  }
}
