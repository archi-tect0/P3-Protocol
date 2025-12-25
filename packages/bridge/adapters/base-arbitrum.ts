import { Contract, JsonRpcProvider, Wallet } from 'ethers';

export interface BridgeAdapter {
  relayReceipt(docHash: string, receiptData: any): Promise<{ txHash: string }>;
  getConfirmations(txHash: string): Promise<number>;
  getRequiredConfirmations(): number;
}

const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
const BASE_TO_ARBITRUM_BRIDGE = process.env.BASE_ARBITRUM_BRIDGE_ADDRESS || '0x0000000000000000000000000000000000000000';

const BRIDGE_ABI = [
  'function relayReceipt(bytes32 docHash, bytes calldata receiptData) external returns (bytes32)',
  'event ReceiptRelayed(bytes32 indexed docHash, bytes32 indexed txHash, uint256 timestamp)',
];

export class BaseToArbitrumAdapter implements BridgeAdapter {
  private provider: JsonRpcProvider;
  private contract: Contract;
  private wallet: Wallet | null = null;

  constructor() {
    this.provider = new JsonRpcProvider(ARBITRUM_RPC);
    this.contract = new Contract(BASE_TO_ARBITRUM_BRIDGE, BRIDGE_ABI, this.provider);
  }

  private getWallet(): Wallet {
    if (!this.wallet) {
      const privateKey = process.env.BRIDGE_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('BRIDGE_PRIVATE_KEY not configured');
      }
      this.wallet = new Wallet(privateKey, this.provider);
    }
    return this.wallet;
  }

  async relayReceipt(docHash: string, receiptData: any): Promise<{ txHash: string }> {
    try {
      const wallet = this.getWallet();
      const contractWithSigner = this.contract.connect(wallet);

      const encodedData = this.encodeReceiptData(receiptData);

      const tx = await contractWithSigner.relayReceipt(docHash, encodedData, {
        gasLimit: 800000,
      });

      await tx.wait(1);

      return { txHash: tx.hash };
    } catch (error) {
      console.error('Base->Arbitrum relay error:', error);
      throw new Error(`Failed to relay to Arbitrum: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConfirmations(txHash: string): Promise<number> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        return 0;
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return 0;
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      return Math.max(0, confirmations);
    } catch (error) {
      console.error('Error getting confirmations:', error);
      return 0;
    }
  }

  getRequiredConfirmations(): number {
    return 20;
  }

  private encodeReceiptData(receiptData: any): string {
    const encoder = new TextEncoder();
    const jsonStr = JSON.stringify(receiptData);
    const bytes = encoder.encode(jsonStr);
    return '0x' + Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
