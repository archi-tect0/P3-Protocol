import { BaseToPolygonAdapter } from '../adapters/base-polygon';
import { BaseToArbitrumAdapter } from '../adapters/base-arbitrum';
import { BaseToOptimismAdapter } from '../adapters/base-optimism';
import type { BridgeAdapter } from '../adapters/base-polygon';

export interface RelayJob {
  id: string;
  docHash: string;
  targetChain: 'polygon' | 'arbitrum' | 'optimism';
  receiptData: any;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'relaying' | 'confirmed' | 'failed';
}

export interface RelayResult {
  success: boolean;
  txHash?: string;
  error?: string;
  confirmations?: number;
}

export class BridgeRelayService {
  private adapters: Map<string, BridgeAdapter>;
  private retryDelays = [1000, 5000, 15000];

  constructor() {
    this.adapters = new Map([
      ['polygon', new BaseToPolygonAdapter()],
      ['arbitrum', new BaseToArbitrumAdapter()],
      ['optimism', new BaseToOptimismAdapter()],
    ]);
  }

  async relayReceipt(
    docHash: string,
    targetChain: 'polygon' | 'arbitrum' | 'optimism',
    receiptData: any,
    attemptNumber: number = 0
  ): Promise<RelayResult> {
    const adapter = this.adapters.get(targetChain);
    if (!adapter) {
      return {
        success: false,
        error: `No adapter found for chain: ${targetChain}`,
      };
    }

    try {
      const { txHash } = await adapter.relayReceipt(docHash, receiptData);

      return {
        success: true,
        txHash,
        confirmations: 1,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Relay attempt ${attemptNumber + 1} failed for ${targetChain}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async retryRelay(
    job: RelayJob,
    onUpdate: (status: string, txHash?: string, error?: string) => Promise<void>
  ): Promise<RelayResult> {
    let lastError = '';

    for (let attempt = job.attempts; attempt < job.maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[Math.min(attempt - 1, this.retryDelays.length - 1)];
        await this.sleep(delay);
      }

      await onUpdate('relaying');

      const result = await this.relayReceipt(
        job.docHash,
        job.targetChain,
        job.receiptData,
        attempt
      );

      if (result.success && result.txHash) {
        await onUpdate('confirmed', result.txHash);
        return result;
      }

      lastError = result.error || 'Unknown error';
      await onUpdate('pending', undefined, lastError);
    }

    await onUpdate('failed', undefined, lastError);

    return {
      success: false,
      error: lastError || 'Max retry attempts exceeded',
    };
  }

  async checkConfirmations(
    targetChain: 'polygon' | 'arbitrum' | 'optimism',
    txHash: string
  ): Promise<{ confirmations: number; required: number }> {
    const adapter = this.adapters.get(targetChain);
    if (!adapter) {
      return { confirmations: 0, required: 0 };
    }

    try {
      const confirmations = await adapter.getConfirmations(txHash);
      const required = adapter.getRequiredConfirmations();

      return { confirmations, required };
    } catch (error) {
      console.error(`Error checking confirmations for ${targetChain}:`, error);
      return { confirmations: 0, required: adapter.getRequiredConfirmations() };
    }
  }

  getAdapter(targetChain: string): BridgeAdapter | undefined {
    return this.adapters.get(targetChain);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
