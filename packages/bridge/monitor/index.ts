import { BridgeRelayService } from '../relay/service';

export interface ChainStatus {
  chain: string;
  txHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  status: 'pending' | 'relaying' | 'confirmed' | 'failed';
  lastError?: string;
  updatedAt: Date;
}

export interface CrossChainStatus {
  docHash: string;
  chains: ChainStatus[];
  overallStatus: 'pending' | 'partial' | 'complete' | 'failed';
}

export class BridgeMonitor {
  private relayService: BridgeRelayService;
  private pollingInterval: number = 30000;
  private activePolls: Map<string, NodeJS.Timeout> = new Map();

  constructor(relayService: BridgeRelayService) {
    this.relayService = relayService;
  }

  async getChainStatus(
    chain: 'polygon' | 'arbitrum' | 'optimism',
    txHash: string | null,
    currentStatus: string
  ): Promise<ChainStatus> {
    if (!txHash || currentStatus === 'failed' || currentStatus === 'pending') {
      return {
        chain,
        txHash,
        confirmations: 0,
        requiredConfirmations: this.getRequiredConfirmations(chain),
        status: currentStatus as any,
        updatedAt: new Date(),
      };
    }

    try {
      const { confirmations, required } = await this.relayService.checkConfirmations(chain, txHash);

      const isConfirmed = confirmations >= required;

      return {
        chain,
        txHash,
        confirmations,
        requiredConfirmations: required,
        status: isConfirmed ? 'confirmed' : 'relaying',
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error(`Error checking status for ${chain}:`, error);
      return {
        chain,
        txHash,
        confirmations: 0,
        requiredConfirmations: this.getRequiredConfirmations(chain),
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      };
    }
  }

  async getCrossChainStatus(
    docHash: string,
    bridgeJobs: Array<{
      targetChain: string;
      txHash: string | null;
      status: string;
      confirmations: number;
      lastError?: string;
    }>
  ): Promise<CrossChainStatus> {
    const chainStatuses: ChainStatus[] = [];

    for (const job of bridgeJobs) {
      const status = await this.getChainStatus(
        job.targetChain as 'polygon' | 'arbitrum' | 'optimism',
        job.txHash,
        job.status
      );

      if (job.lastError) {
        status.lastError = job.lastError;
      }

      chainStatuses.push(status);
    }

    const overallStatus = this.calculateOverallStatus(chainStatuses);

    return {
      docHash,
      chains: chainStatuses,
      overallStatus,
    };
  }

  startPolling(
    docHash: string,
    targetChain: 'polygon' | 'arbitrum' | 'optimism',
    txHash: string,
    onUpdate: (confirmations: number, status: string) => Promise<void>
  ): void {
    const pollKey = `${docHash}-${targetChain}`;

    if (this.activePolls.has(pollKey)) {
      return;
    }

    const poll = async () => {
      try {
        const { confirmations, required } = await this.relayService.checkConfirmations(
          targetChain,
          txHash
        );

        const isConfirmed = confirmations >= required;
        await onUpdate(confirmations, isConfirmed ? 'confirmed' : 'relaying');

        if (isConfirmed) {
          this.stopPolling(pollKey);
        }
      } catch (error) {
        console.error(`Polling error for ${pollKey}:`, error);
      }
    };

    const interval = setInterval(poll, this.pollingInterval);
    this.activePolls.set(pollKey, interval);

    poll();
  }

  stopPolling(pollKey: string): void {
    const interval = this.activePolls.get(pollKey);
    if (interval) {
      clearInterval(interval);
      this.activePolls.delete(pollKey);
    }
  }

  stopAllPolling(): void {
    for (const interval of this.activePolls.values()) {
      clearInterval(interval);
    }
    this.activePolls.clear();
  }

  private calculateOverallStatus(
    chains: ChainStatus[]
  ): 'pending' | 'partial' | 'complete' | 'failed' {
    if (chains.length === 0) {
      return 'pending';
    }

    const failedCount = chains.filter(c => c.status === 'failed').length;
    const confirmedCount = chains.filter(c => c.status === 'confirmed').length;
    const totalCount = chains.length;

    if (failedCount === totalCount) {
      return 'failed';
    }

    if (confirmedCount === totalCount) {
      return 'complete';
    }

    if (confirmedCount > 0) {
      return 'partial';
    }

    return 'pending';
  }

  private getRequiredConfirmations(chain: string): number {
    const adapter = this.relayService.getAdapter(chain);
    return adapter?.getRequiredConfirmations() || 12;
  }
}
