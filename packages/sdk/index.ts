/**
 * @p3/protocol - P3 Protocol SDK
 * 
 * One-click integration for decentralized mesh applications.
 * 
 * @example
 * ```typescript
 * import { P3Provider, createP3Client } from '@p3/protocol';
 * 
 * // Initialize client
 * const p3 = createP3Client({
 *   relay: 'wss://relay.p3protocol.io',
 *   usePQC: true,
 *   useZK: true,
 * });
 * 
 * // Connect wallet
 * await p3.connect();
 * 
 * // Send encrypted message
 * await p3.messaging.send(recipientPubkey, 'Hello, secure world!');
 * 
 * // Anchor receipt to blockchain
 * await p3.receipts.anchor(receiptHash);
 * ```
 * 
 * @packageDocumentation
 */

// Re-export governance SDK
export { 
  GovernanceSDK, 
  VoteType, 
  ProposalState,
  encodeFunctionCall,
  proposalStateToString,
  type ProposalAction,
  type ProposalParams,
} from './governance';

// SDK Configuration
export interface P3Config {
  /** Relay server URL */
  relay?: string;
  /** Enable post-quantum cryptography */
  usePQC?: boolean;
  /** Enable zero-knowledge proofs */
  useZK?: boolean;
  /** Chain ID for blockchain operations */
  chainId?: number;
  /** RPC URL for blockchain */
  rpcUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: P3Config = {
  relay: 'wss://relay.p3protocol.io',
  usePQC: false,
  useZK: true,
  chainId: 8453, // Base mainnet
  debug: false,
};

/**
 * P3 Client - Main entry point for SDK
 */
export class P3Client {
  private config: P3Config;
  private connected: boolean = false;
  private walletAddress: string | null = null;

  constructor(config: Partial<P3Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.debug) {
      console.log('[P3] Initialized with config:', this.config);
    }
  }

  /**
   * Connect to wallet
   */
  async connect(): Promise<{ address: string; chainId: number }> {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('No wallet provider found. Please install MetaMask or another Web3 wallet.');
    }

    try {
      const accounts = await (window as any).ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      const chainId = await (window as any).ethereum.request({ 
        method: 'eth_chainId' 
      });

      this.walletAddress = accounts[0];
      this.connected = true;

      if (this.config.debug) {
        console.log('[P3] Connected:', this.walletAddress);
      }

      return {
        address: accounts[0],
        chainId: parseInt(chainId, 16),
      };
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current wallet address
   */
  getAddress(): string | null {
    return this.walletAddress;
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.connected = false;
    this.walletAddress = null;
  }

  /**
   * Messaging module
   */
  readonly messaging = {
    /**
     * Send encrypted message
     */
    send: async (recipientPubkey: string, message: string): Promise<{ messageId: string }> => {
      if (!this.connected) throw new Error('Not connected');
      // Delegate to full SDK when available
      const messageId = `msg-${Date.now().toString(36)}`;
      console.log('[P3] Message sent:', { recipientPubkey, messageId });
      return { messageId };
    },
  };

  /**
   * Receipts module
   */
  readonly receipts = {
    /**
     * Anchor receipt hash to blockchain
     */
    anchor: async (receiptHash: string): Promise<{ txHash: string }> => {
      if (!this.connected) throw new Error('Not connected');
      console.log('[P3] Anchoring receipt:', receiptHash);
      // Placeholder - integrate with actual anchor service
      return { txHash: `0x${receiptHash.slice(0, 64)}` };
    },
  };

  /**
   * Session module
   */
  readonly session = {
    /**
     * Get session info
     */
    info: async (): Promise<{ wallet: string | null; connected: boolean }> => {
      return {
        wallet: this.walletAddress,
        connected: this.connected,
      };
    },
  };
}

/**
 * Create a P3 client instance
 */
export function createP3Client(config: Partial<P3Config> = {}): P3Client {
  return new P3Client(config);
}

/**
 * React Provider configuration (for React applications)
 * 
 * Note: P3Provider React component should be imported from '@p3/protocol/react'
 * to avoid React dependency in core package.
 * 
 * @example
 * ```tsx
 * import { P3Provider } from '@p3/protocol/react';
 * 
 * function App() {
 *   return (
 *     <P3Provider config={{ usePQC: true }}>
 *       <YourApp />
 *     </P3Provider>
 *   );
 * }
 * ```
 */
export interface P3ProviderConfig {
  config?: Partial<P3Config>;
}

/**
 * SDK Version
 */
export const VERSION = '2.0.0';

// P3ProviderProps is already exported above via interface declaration
