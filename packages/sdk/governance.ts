import { ethers } from "ethers";

/**
 * GovernorP3 SDK - Blockchain interaction layer for DAO governance
 * 
 * Provides functions to interact with the GovernorP3 contract:
 * - Create proposals
 * - Vote on proposals
 * - Queue proposals (timelock)
 * - Execute proposals
 */

// Governor ABI - only the functions we need
const GOVERNOR_ABI = [
  "function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support) returns (uint256)",
  "function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)",
  "function queue(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) returns (uint256)",
  "function execute(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
  "function proposalDeadline(uint256 proposalId) view returns (uint256)",
  "function proposalEta(uint256 proposalId) view returns (uint256)",
  "function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
  "function hashProposal(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) view returns (uint256)",
];

export interface ProposalAction {
  target: string;
  value: string;
  calldata: string;
}

export interface ProposalParams {
  targets: string[];
  values: string[];
  calldatas: string[];
  description: string;
}

export enum VoteType {
  Against = 0,
  For = 1,
  Abstain = 2,
}

export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

export class GovernanceSDK {
  private governorContract: ethers.Contract;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  constructor(
    governorAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.provider = provider;
    this.signer = signer;
    
    if (signer) {
      this.governorContract = new ethers.Contract(governorAddress, GOVERNOR_ABI, signer);
    } else {
      this.governorContract = new ethers.Contract(governorAddress, GOVERNOR_ABI, provider);
    }
  }

  /**
   * Create a new proposal for policy changes
   * @param actions - Array of actions to execute
   * @param description - Human-readable proposal description
   * @returns Transaction response and proposal ID
   */
  async proposePolicyChange(
    actions: ProposalAction[],
    description: string
  ): Promise<{ tx: ethers.TransactionResponse; proposalId: string }> {
    if (!this.signer) {
      throw new Error("Signer required to create proposals");
    }

    const targets = actions.map(a => a.target);
    const values = actions.map(a => a.value);
    const calldatas = actions.map(a => a.calldata);

    const tx = await this.governorContract.propose(
      targets,
      values,
      calldatas,
      description
    );

    const receipt = await tx.wait();
    
    // Get proposal ID from event
    const proposalCreatedEvent = receipt.logs.find(
      (log: any) => {
        try {
          const parsed = this.governorContract.interface.parseLog(log);
          return parsed?.name === "ProposalCreated";
        } catch {
          return false;
        }
      }
    );

    let proposalId: string;
    if (proposalCreatedEvent) {
      const parsed = this.governorContract.interface.parseLog(proposalCreatedEvent);
      proposalId = parsed?.args.proposalId.toString();
    } else {
      // Compute proposal ID from parameters
      const descriptionHash = ethers.id(description);
      proposalId = await this.governorContract.hashProposal(
        targets,
        values,
        calldatas,
        descriptionHash
      );
      proposalId = proposalId.toString();
    }

    return { tx, proposalId };
  }

  /**
   * Vote on a proposal
   * @param proposalId - The proposal ID to vote on
   * @param support - Vote type (0 = Against, 1 = For, 2 = Abstain)
   * @param reason - Optional voting reason
   * @returns Transaction response
   */
  async vote(
    proposalId: string,
    support: VoteType,
    reason?: string
  ): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error("Signer required to vote");
    }

    if (reason) {
      return await this.governorContract.castVoteWithReason(
        proposalId,
        support,
        reason
      );
    } else {
      return await this.governorContract.castVote(proposalId, support);
    }
  }

  /**
   * Queue a succeeded proposal for execution (timelock)
   * @param params - Proposal parameters
   * @returns Transaction response
   */
  async queueProposal(params: ProposalParams): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error("Signer required to queue proposals");
    }

    const descriptionHash = ethers.id(params.description);

    return await this.governorContract.queue(
      params.targets,
      params.values,
      params.calldatas,
      descriptionHash
    );
  }

  /**
   * Execute a queued proposal
   * @param params - Proposal parameters
   * @returns Transaction response
   */
  async executeProposal(params: ProposalParams): Promise<ethers.TransactionResponse> {
    if (!this.signer) {
      throw new Error("Signer required to execute proposals");
    }

    const descriptionHash = ethers.id(params.description);

    return await this.governorContract.execute(
      params.targets,
      params.values,
      params.calldatas,
      descriptionHash
    );
  }

  /**
   * Get proposal state
   * @param proposalId - The proposal ID
   * @returns ProposalState enum value
   */
  async getProposalState(proposalId: string): Promise<ProposalState> {
    const state = await this.governorContract.state(proposalId);
    return state as ProposalState;
  }

  /**
   * Get proposal vote counts
   * @param proposalId - The proposal ID
   * @returns Vote counts (against, for, abstain)
   */
  async getProposalVotes(proposalId: string): Promise<{
    against: string;
    for: string;
    abstain: string;
  }> {
    const [againstVotes, forVotes, abstainVotes] = await this.governorContract.proposalVotes(proposalId);
    
    return {
      against: againstVotes.toString(),
      for: forVotes.toString(),
      abstain: abstainVotes.toString(),
    };
  }

  /**
   * Get proposal snapshot (block number when voting starts)
   * @param proposalId - The proposal ID
   * @returns Block number
   */
  async getProposalSnapshot(proposalId: string): Promise<string> {
    const snapshot = await this.governorContract.proposalSnapshot(proposalId);
    return snapshot.toString();
  }

  /**
   * Get proposal deadline (block number when voting ends)
   * @param proposalId - The proposal ID
   * @returns Block number
   */
  async getProposalDeadline(proposalId: string): Promise<string> {
    const deadline = await this.governorContract.proposalDeadline(proposalId);
    return deadline.toString();
  }

  /**
   * Get proposal ETA (timestamp when proposal can be executed)
   * @param proposalId - The proposal ID
   * @returns Timestamp
   */
  async getProposalEta(proposalId: string): Promise<string> {
    const eta = await this.governorContract.proposalEta(proposalId);
    return eta.toString();
  }

  /**
   * Hash proposal parameters to get proposal ID
   * @param params - Proposal parameters
   * @returns Proposal ID
   */
  async hashProposal(params: ProposalParams): Promise<string> {
    const descriptionHash = ethers.id(params.description);
    const proposalId = await this.governorContract.hashProposal(
      params.targets,
      params.values,
      params.calldatas,
      descriptionHash
    );
    return proposalId.toString();
  }
}

/**
 * Helper function to encode function calls for proposals
 */
export function encodeFunctionCall(
  contractInterface: ethers.Interface,
  functionName: string,
  args: any[]
): string {
  return contractInterface.encodeFunctionData(functionName, args);
}

/**
 * Helper to convert proposal state enum to string
 */
export function proposalStateToString(state: ProposalState): string {
  const states = [
    "Pending",
    "Active",
    "Canceled",
    "Defeated",
    "Succeeded",
    "Queued",
    "Expired",
    "Executed",
  ];
  return states[state] || "Unknown";
}
