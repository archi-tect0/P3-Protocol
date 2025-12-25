import { ethers, Log } from 'ethers';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'blockchain' });

export interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  governorAddress?: string;
  tokenAddress?: string;
  timelockAddress?: string;
  anchorRegistryAddress?: string;
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private config: BlockchainConfig;

  // Contract ABIs (minimal for now, full ABIs would be in artifacts/)
  private readonly GOVERNOR_ABI = [
    "function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) public returns (uint256)",
    "function castVote(uint256 proposalId, uint8 support) public returns (uint256)",
    "function queue(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) public returns (uint256)",
    "function execute(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) public payable returns (uint256)",
    "function state(uint256 proposalId) public view returns (uint8)",
    "function proposalVotes(uint256 proposalId) public view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
    "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
    "event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)"
  ];

  private readonly TOKEN_ABI = [
    "function balanceOf(address account) public view returns (uint256)",
    "function delegate(address delegatee) public",
    "function getVotes(address account) public view returns (uint256)",
    "function transfer(address to, uint256 amount) public returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ];

  private readonly ANCHOR_REGISTRY_ABI = [
    "function anchorData(bytes32 contentHash, string memory metadata) public payable returns (uint256 anchorId)",
    "function getAnchor(uint256 anchorId) public view returns (bytes32 contentHash, address anchorer, uint256 timestamp, string memory metadata)",
    "function verifyAnchor(uint256 anchorId, bytes32 contentHash) public view returns (bool)",
    "event DataAnchored(uint256 indexed anchorId, bytes32 indexed contentHash, address indexed anchorer, uint256 timestamp)"
  ];

  constructor(config: BlockchainConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    logger.info('Blockchain service initialized', { 
      network: config.rpcUrl,
      walletAddress: this.wallet.address 
    });
  }

  async getWalletAddress(): Promise<string> {
    return this.wallet.address;
  }

  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  // DAO Governance Functions
  async createProposal(
    title: string,
    description: string,
    targets: string[],
    values: string[],
    calldatas: string[]
  ): Promise<{ proposalId: string; txHash: string }> {
    if (!this.config.governorAddress) {
      throw new Error('Governor contract address not configured');
    }

    const governor = new ethers.Contract(
      this.config.governorAddress,
      this.GOVERNOR_ABI,
      this.wallet
    );

    const fullDescription = `${title}\n\n${description}`;
    
    try {
      const tx = await governor.propose(targets, values, calldatas, fullDescription);
      const receipt = await tx.wait();
      
      // Find ProposalCreated event to get proposalId
      const event = receipt.logs.find((log: Log) => {
        try {
          const parsed = governor.interface.parseLog(log);
          return parsed?.name === 'ProposalCreated';
        } catch {
          return false;
        }
      });

      if (!event) {
        throw new Error('ProposalCreated event not found');
      }

      const parsed = governor.interface.parseLog(event);
      const proposalId = parsed?.args[0].toString();

      logger.info('Proposal created on-chain', { proposalId, txHash: receipt.hash });

      return {
        proposalId,
        txHash: receipt.hash,
      };
    } catch (error) {
      logger.error('Failed to create proposal on-chain', error as Error);
      throw error;
    }
  }

  async castVote(
    proposalId: string,
    support: 'for' | 'against' | 'abstain'
  ): Promise<{ txHash: string; votingPower: string }> {
    if (!this.config.governorAddress) {
      throw new Error('Governor contract address not configured');
    }

    const governor = new ethers.Contract(
      this.config.governorAddress,
      this.GOVERNOR_ABI,
      this.wallet
    );

    const supportValue = support === 'for' ? 1 : support === 'against' ? 0 : 2;

    try {
      const tx = await governor.castVote(proposalId, supportValue);
      const receipt = await tx.wait();

      // Find VoteCast event to get voting power
      const event = receipt.logs.find((log: Log) => {
        try {
          const parsed = governor.interface.parseLog(log);
          return parsed?.name === 'VoteCast';
        } catch {
          return false;
        }
      });

      let votingPower = '0';
      if (event) {
        const parsed = governor.interface.parseLog(event);
        votingPower = parsed?.args[3].toString();
      }

      logger.info('Vote cast on-chain', { proposalId, support, txHash: receipt.hash });

      return {
        txHash: receipt.hash,
        votingPower,
      };
    } catch (error) {
      logger.error('Failed to cast vote on-chain', error as Error);
      throw error;
    }
  }

  async queueProposal(
    proposalId: string,
    targets: string[],
    values: string[],
    calldatas: string[],
    descriptionHash: string
  ): Promise<{ txHash: string }> {
    if (!this.config.governorAddress) {
      throw new Error('Governor contract address not configured');
    }

    const governor = new ethers.Contract(
      this.config.governorAddress,
      this.GOVERNOR_ABI,
      this.wallet
    );

    try {
      const tx = await governor.queue(targets, values, calldatas, descriptionHash);
      const receipt = await tx.wait();

      logger.info('Proposal queued on-chain', { proposalId, txHash: receipt.hash });

      return { txHash: receipt.hash };
    } catch (error) {
      logger.error('Failed to queue proposal on-chain', error as Error);
      throw error;
    }
  }

  async executeProposal(
    proposalId: string,
    targets: string[],
    values: string[],
    calldatas: string[],
    descriptionHash: string
  ): Promise<{ txHash: string }> {
    if (!this.config.governorAddress) {
      throw new Error('Governor contract address not configured');
    }

    const governor = new ethers.Contract(
      this.config.governorAddress,
      this.GOVERNOR_ABI,
      this.wallet
    );

    try {
      const tx = await governor.execute(targets, values, calldatas, descriptionHash);
      const receipt = await tx.wait();

      logger.info('Proposal executed on-chain', { proposalId, txHash: receipt.hash });

      return { txHash: receipt.hash };
    } catch (error) {
      logger.error('Failed to execute proposal on-chain', error as Error);
      throw error;
    }
  }

  async getProposalState(proposalId: string): Promise<string> {
    if (!this.config.governorAddress) {
      throw new Error('Governor contract address not configured');
    }

    const governor = new ethers.Contract(
      this.config.governorAddress,
      this.GOVERNOR_ABI,
      this.provider
    );

    const stateNumber = await governor.state(proposalId);
    
    // ProposalState enum: Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed
    const states = ['pending', 'active', 'canceled', 'defeated', 'succeeded', 'queued', 'expired', 'executed'];
    return states[stateNumber] || 'unknown';
  }

  async getProposalVotes(proposalId: string): Promise<{
    against: string;
    for: string;
    abstain: string;
  }> {
    if (!this.config.governorAddress) {
      throw new Error('Governor contract address not configured');
    }

    const governor = new ethers.Contract(
      this.config.governorAddress,
      this.GOVERNOR_ABI,
      this.provider
    );

    const votes = await governor.proposalVotes(proposalId);
    
    return {
      against: votes[0].toString(),
      for: votes[1].toString(),
      abstain: votes[2].toString(),
    };
  }

  // Anchoring Functions
  async anchorData(contentHash: string, metadata: string): Promise<{ anchorId: string; txHash: string }> {
    if (!this.config.anchorRegistryAddress) {
      throw new Error('Anchor registry contract address not configured');
    }

    const anchorRegistry = new ethers.Contract(
      this.config.anchorRegistryAddress,
      this.ANCHOR_REGISTRY_ABI,
      this.wallet
    );

    try {
      const tx = await anchorRegistry.anchorData(contentHash, metadata);
      const receipt = await tx.wait();

      // Find DataAnchored event to get anchorId
      const event = receipt.logs.find((log: Log) => {
        try {
          const parsed = anchorRegistry.interface.parseLog(log);
          return parsed?.name === 'DataAnchored';
        } catch {
          return false;
        }
      });

      if (!event) {
        throw new Error('DataAnchored event not found');
      }

      const parsed = anchorRegistry.interface.parseLog(event);
      const anchorId = parsed?.args[0].toString();

      logger.info('Data anchored on-chain', { anchorId, txHash: receipt.hash });

      return {
        anchorId,
        txHash: receipt.hash,
      };
    } catch (error) {
      logger.error('Failed to anchor data on-chain', error as Error);
      throw error;
    }
  }

  async verifyAnchor(anchorId: string, contentHash: string): Promise<boolean> {
    if (!this.config.anchorRegistryAddress) {
      throw new Error('Anchor registry contract address not configured');
    }

    const anchorRegistry = new ethers.Contract(
      this.config.anchorRegistryAddress,
      this.ANCHOR_REGISTRY_ABI,
      this.provider
    );

    return await anchorRegistry.verifyAnchor(anchorId, contentHash);
  }

  // Token Functions
  async getVotingPower(address: string): Promise<string> {
    if (!this.config.tokenAddress) {
      throw new Error('Token contract address not configured');
    }

    const token = new ethers.Contract(
      this.config.tokenAddress,
      this.TOKEN_ABI,
      this.provider
    );

    const votes = await token.getVotes(address);
    return votes.toString();
  }

  async delegateVotes(delegatee: string): Promise<{ txHash: string }> {
    if (!this.config.tokenAddress) {
      throw new Error('Token contract address not configured');
    }

    const token = new ethers.Contract(
      this.config.tokenAddress,
      this.TOKEN_ABI,
      this.wallet
    );

    try {
      const tx = await token.delegate(delegatee);
      const receipt = await tx.wait();

      logger.info('Votes delegated on-chain', { delegatee, txHash: receipt.hash });

      return { txHash: receipt.hash };
    } catch (error) {
      logger.error('Failed to delegate votes on-chain', error as Error);
      throw error;
    }
  }
}

// Singleton instances for different networks
let baseSepolia: BlockchainService | null = null;
let baseMainnet: BlockchainService | null = null;

export function getBaseSepoliaService(): BlockchainService {
  if (!baseSepolia) {
    const config: BlockchainConfig = {
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      privateKey: process.env.PRIVATE_KEY || '',
      governorAddress: process.env.GOVERNOR_SEPOLIA_ADDRESS,
      tokenAddress: process.env.TOKEN_SEPOLIA_ADDRESS,
      anchorRegistryAddress: '0xD0b8f9f6c9055574D835355B466C418b7558aCE0',
    };
    
    if (!config.privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }
    
    baseSepolia = new BlockchainService(config);
  }
  return baseSepolia;
}

export function getBaseMainnetService(): BlockchainService {
  if (!baseMainnet) {
    const config: BlockchainConfig = {
      rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
      privateKey: process.env.PRIVATE_KEY || '',
      governorAddress: process.env.GOVERNOR_BASE_ADDRESS,
      tokenAddress: process.env.TOKEN_BASE_ADDRESS,
      anchorRegistryAddress: '0x2539823790424051Eb03eBea1EA9bc40A475A34D',
    };
    
    if (!config.privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }
    
    baseMainnet = new BlockchainService(config);
  }
  return baseMainnet;
}
