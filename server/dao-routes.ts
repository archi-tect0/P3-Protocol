import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { keccak256, toUtf8Bytes } from 'ethers';
import type { IStorage } from './storage';
import { authenticateJWT, type AuthenticatedRequest } from './auth';
import { getBaseSepoliaService, BlockchainService } from './services/blockchain';
import { rootLogger } from './observability/logger';
import { 
  handleError, 
  AppError, 
  ErrorCategory,
  withDatabaseErrorHandling,
  withBlockchainErrorHandling,
  blockchainTxTracker,
} from './utils/error-handler';

const logger = rootLogger.child({ module: 'dao-routes' });

/**
 * DAO Routes - Governance endpoints with blockchain integration
 * 
 * Production-ready implementation for:
 * - Creating proposals (synced to blockchain)
 * - Listing proposals
 * - Voting on proposals (synced to blockchain)
 * - Queueing proposals (blockchain timelock)
 * - Executing proposals (synced to blockchain)
 * 
 * Returns 503 errors if blockchain is not properly configured
 */

// Validation schemas
const createProposalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  targets: z.array(z.string()).min(1, 'At least one target is required'),
  values: z.array(z.string()).min(1, 'At least one value is required'),
  calldatas: z.array(z.string()).min(1, 'At least one calldata is required'),
}).refine(
  data => data.targets.length === data.values.length && data.values.length === data.calldatas.length,
  { message: 'targets, values, and calldatas must have the same length' }
);

const voteSchema = z.object({
  support: z.enum(['for', 'against', 'abstain']),
  votingPower: z.string().regex(/^\d+$/, 'Voting power must be a positive number'),
});

/**
 * Helper function to validate request body
 */
function validateBody<T>(schema: z.ZodSchema<T>, body: any): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.errors.map(e => e.message).join(', ')}`);
  }
  return result.data;
}

/**
 * Helper function to get blockchain service with proper error handling
 * Returns null if blockchain is not configured
 */
function getBlockchainService(): BlockchainService | null {
  try {
    return getBaseSepoliaService();
  } catch (error) {
    logger.warn('Blockchain service not configured', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
}

/**
 * Helper to compute description hash for proposal operations
 */
function computeDescriptionHash(title: string, description: string): string {
  const fullDescription = `${title}\n\n${description}`;
  return keccak256(toUtf8Bytes(fullDescription));
}

/**
 * Create DAO routes
 */
export function createDAORoutes(storage: IStorage): Router {
  const router = Router();

  /**
   * GET /api/dao/proposals
   * List all DAO proposals with optional filters
   */
  router.get('/api/dao/proposals', async (req: Request, res: Response) => {
    try {
      const filters: any = {};
      
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      
      if (req.query.proposer) {
        filters.proposer = req.query.proposer as string;
      }

      const proposals = await withDatabaseErrorHandling(
        () => storage.listDaoProposals(filters),
        {
          operation: 'listDaoProposals',
          entityType: 'dao_proposal',
        }
      );

      res.json(proposals);
    } catch (error) {
      handleError(error, res, {
        operation: 'listDaoProposals',
        entityType: 'dao_proposal',
        requestId: req.id,
      });
    }
  });

  /**
   * POST /api/dao/proposals
   * Create a new DAO proposal
   * Requires authentication
   * Creates proposal on blockchain and stores in database
   */
  router.post('/api/dao/proposals', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const trackingId = `proposal-create-${Date.now()}`;
    
    try {
      const data = validateBody(createProposalSchema, req.body);

      if (!req.user) {
        throw new AppError(ErrorCategory.AUTHENTICATION, 'Authentication required');
      }

      // Check if blockchain is configured
      const blockchain = getBlockchainService();
      if (!blockchain) {
        throw new AppError(
          ErrorCategory.BLOCKCHAIN,
          'Blockchain service unavailable',
          { hint: 'Governance blockchain is not configured. Please contact administrator.' }
        );
      }

      // Get user details for proposer address
      const user = await withDatabaseErrorHandling(
        () => storage.getUserById(req.user!.userId),
        {
          operation: 'getUserById',
          userId: req.user.userId,
          entityType: 'user',
        }
      );

      if (!user) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'User not found');
      }

      // Create proposal on blockchain with transaction tracking
      logger.info('Creating proposal on blockchain', { 
        title: data.title, 
        proposer: user.email,
        trackingId,
      });

      const blockchainResult = await withBlockchainErrorHandling(
        () => blockchain.createProposal(
          data.title,
          data.description,
          data.targets,
          data.values,
          data.calldatas
        ),
        {
          operation: 'createProposal',
          userId: req.user.userId,
          trackingId,
        }
      );

      // Store proposal in database with blockchain data
      const proposal = await withDatabaseErrorHandling(
        () => storage.createDaoProposal({
          proposalId: blockchainResult.proposalId,
          proposer: user.email,
          title: data.title,
          description: data.description,
          targets: data.targets,
          values: data.values,
          calldatas: data.calldatas,
          status: 'pending',
          votesFor: '0',
          votesAgainst: '0',
          votesAbstain: '0',
          startBlock: null,
          endBlock: null,
          txHash: blockchainResult.txHash,
          metadata: {
            createdBy: req.user.userId,
            createdAt: new Date().toISOString(),
            blockchainProposalId: blockchainResult.proposalId,
            descriptionHash: computeDescriptionHash(data.title, data.description),
            trackingId,
          },
        }),
        {
          operation: 'createDaoProposal',
          userId: req.user.userId,
          entityType: 'dao_proposal',
        }
      );

      // Confirm blockchain transaction tracking
      blockchainTxTracker.confirm(trackingId);

      logger.info('Proposal created successfully', { 
        proposalId: proposal.proposalId,
        txHash: blockchainResult.txHash,
        trackingId,
      });

      res.status(201).json(proposal);
    } catch (error) {
      // Clear blockchain transaction tracking on error
      blockchainTxTracker.clear(trackingId);
      
      handleError(error, res, {
        operation: 'createDaoProposal',
        userId: req.user?.userId,
        entityType: 'dao_proposal',
        requestId: req.id,
      });
    }
  });

  /**
   * POST /api/dao/proposals/:id/vote
   * Vote on a proposal
   * Requires authentication
   * Casts vote on blockchain and updates database
   */
  router.post('/api/dao/proposals/:id/vote', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = req.params.id;
    const trackingId = `vote-${proposalId}-${Date.now()}`;
    
    try {
      const data = validateBody(voteSchema, req.body);

      if (!req.user) {
        throw new AppError(ErrorCategory.AUTHENTICATION, 'Authentication required');
      }

      // Check if blockchain is configured
      const blockchain = getBlockchainService();
      if (!blockchain) {
        throw new AppError(
          ErrorCategory.BLOCKCHAIN,
          'Blockchain service unavailable',
          { hint: 'Governance blockchain is not configured. Please contact administrator.' }
        );
      }

      // Get proposal from database
      const proposal = await withDatabaseErrorHandling(
        () => storage.getDaoProposal(proposalId),
        {
          operation: 'getDaoProposal',
          userId: req.user.userId,
          entityType: 'dao_proposal',
          entityId: proposalId,
        }
      );

      if (!proposal) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Proposal not found', { proposalId });
      }

      // Check if proposal is in a votable state
      if (proposal.status !== 'pending' && proposal.status !== 'active') {
        throw new AppError(
          ErrorCategory.VALIDATION,
          'Proposal is not in a votable state',
          { proposalId, currentStatus: proposal.status }
        );
      }

      // Cast vote on blockchain with transaction tracking
      logger.info('Casting vote on blockchain', { 
        proposalId, 
        support: data.support,
        voter: req.user.userId,
        trackingId,
      });

      const voteResult = await withBlockchainErrorHandling(
        () => blockchain.castVote(proposalId, data.support),
        {
          operation: 'castVote',
          userId: req.user.userId,
          trackingId,
        }
      );

      // Update vote counts based on support type using blockchain voting power
      const votingPower = BigInt(voteResult.votingPower);
      let votesFor = BigInt(proposal.votesFor || '0');
      let votesAgainst = BigInt(proposal.votesAgainst || '0');
      let votesAbstain = BigInt(proposal.votesAbstain || '0');

      switch (data.support) {
        case 'for':
          votesFor += votingPower;
          break;
        case 'against':
          votesAgainst += votingPower;
          break;
        case 'abstain':
          votesAbstain += votingPower;
          break;
      }

      // Update proposal in database with blockchain data
      const updatedProposal = await withDatabaseErrorHandling(
        () => storage.updateDaoProposal(proposalId, {
          votesFor: votesFor.toString(),
          votesAgainst: votesAgainst.toString(),
          votesAbstain: votesAbstain.toString(),
          status: 'active',
        }),
        {
          operation: 'updateDaoProposal',
          userId: req.user.userId,
          entityType: 'dao_proposal',
          entityId: proposalId,
        }
      );

      // Confirm blockchain transaction tracking
      blockchainTxTracker.confirm(trackingId);

      logger.info('Vote cast successfully', { 
        proposalId,
        txHash: voteResult.txHash,
        votingPower: voteResult.votingPower,
        trackingId,
      });

      res.json({
        ...updatedProposal,
        voteTxHash: voteResult.txHash,
        actualVotingPower: voteResult.votingPower,
      });
    } catch (error) {
      // Clear blockchain transaction tracking on error
      blockchainTxTracker.clear(trackingId);
      
      handleError(error, res, {
        operation: 'voteOnProposal',
        userId: req.user?.userId,
        entityType: 'dao_proposal',
        entityId: proposalId,
        requestId: req.id,
      });
    }
  });

  /**
   * POST /api/dao/proposals/:id/queue
   * Queue a proposal in the timelock
   * Requires authentication
   * Queues proposal on blockchain for execution after timelock delay
   */
  router.post('/api/dao/proposals/:id/queue', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = req.params.id;
    const trackingId = `queue-${proposalId}-${Date.now()}`;
    
    try {
      if (!req.user) {
        throw new AppError(ErrorCategory.AUTHENTICATION, 'Authentication required');
      }

      // Check if blockchain is configured
      const blockchain = getBlockchainService();
      if (!blockchain) {
        throw new AppError(
          ErrorCategory.BLOCKCHAIN,
          'Blockchain service unavailable',
          { hint: 'Governance blockchain is not configured. Please contact administrator.' }
        );
      }

      // Get proposal from database
      const proposal = await withDatabaseErrorHandling(
        () => storage.getDaoProposal(proposalId),
        {
          operation: 'getDaoProposal',
          userId: req.user.userId,
          entityType: 'dao_proposal',
          entityId: proposalId,
        }
      );

      if (!proposal) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Proposal not found', { proposalId });
      }

      // Check if proposal succeeded
      const votesFor = BigInt(proposal.votesFor || '0');
      const votesAgainst = BigInt(proposal.votesAgainst || '0');

      if (votesFor <= votesAgainst) {
        throw new AppError(
          ErrorCategory.VALIDATION,
          'Proposal did not succeed',
          {
            proposalId,
            votesFor: votesFor.toString(),
            votesAgainst: votesAgainst.toString(),
          }
        );
      }

      // Compute description hash
      const descriptionHash = computeDescriptionHash(proposal.title, proposal.description);

      // Queue proposal on blockchain with transaction tracking
      logger.info('Queueing proposal on blockchain', { 
        proposalId,
        trackingId,
      });

      const queueResult = await withBlockchainErrorHandling(
        () => blockchain.queueProposal(
          proposalId,
          proposal.targets,
          proposal.values,
          proposal.calldatas,
          descriptionHash
        ),
        {
          operation: 'queueProposal',
          userId: req.user.userId,
          trackingId,
        }
      );

      // Update proposal status to queued
      const updatedProposal = await withDatabaseErrorHandling(
        () => storage.updateDaoProposal(proposalId, {
          status: 'queued',
        }),
        {
          operation: 'updateDaoProposal',
          userId: req.user.userId,
          entityType: 'dao_proposal',
          entityId: proposalId,
        }
      );

      // Confirm blockchain transaction tracking
      blockchainTxTracker.confirm(trackingId);

      logger.info('Proposal queued successfully', { 
        proposalId,
        txHash: queueResult.txHash,
        trackingId,
      });

      res.json({
        ...updatedProposal,
        queueTxHash: queueResult.txHash,
      });
    } catch (error) {
      // Clear blockchain transaction tracking on error
      blockchainTxTracker.clear(trackingId);
      
      handleError(error, res, {
        operation: 'queueProposal',
        userId: req.user?.userId,
        entityType: 'dao_proposal',
        entityId: proposalId,
        requestId: req.id,
      });
    }
  });

  /**
   * POST /api/dao/proposals/:id/execute
   * Execute a proposal
   * Requires authentication
   * Executes proposal on blockchain after timelock delay
   */
  router.post('/api/dao/proposals/:id/execute', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = req.params.id;
    const trackingId = `execute-${proposalId}-${Date.now()}`;
    
    try {
      if (!req.user) {
        throw new AppError(ErrorCategory.AUTHENTICATION, 'Authentication required');
      }

      // Check if blockchain is configured
      const blockchain = getBlockchainService();
      if (!blockchain) {
        throw new AppError(
          ErrorCategory.BLOCKCHAIN,
          'Blockchain service unavailable',
          { hint: 'Governance blockchain is not configured. Please contact administrator.' }
        );
      }

      // Get proposal from database
      const proposal = await withDatabaseErrorHandling(
        () => storage.getDaoProposal(proposalId),
        {
          operation: 'getDaoProposal',
          userId: req.user.userId,
          entityType: 'dao_proposal',
          entityId: proposalId,
        }
      );

      if (!proposal) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Proposal not found', { proposalId });
      }

      // Check if proposal is queued (required before execution)
      if (proposal.status !== 'queued') {
        throw new AppError(
          ErrorCategory.VALIDATION,
          'Proposal must be queued before execution',
          { proposalId, currentStatus: proposal.status }
        );
      }

      // Compute description hash
      const descriptionHash = computeDescriptionHash(proposal.title, proposal.description);

      // Execute proposal on blockchain with transaction tracking
      logger.info('Executing proposal on blockchain', { 
        proposalId,
        trackingId,
      });

      const executeResult = await withBlockchainErrorHandling(
        () => blockchain.executeProposal(
          proposalId,
          proposal.targets,
          proposal.values,
          proposal.calldatas,
          descriptionHash
        ),
        {
          operation: 'executeProposal',
          userId: req.user.userId,
          trackingId,
        }
      );

      // Update proposal status to executed
      const updatedProposal = await withDatabaseErrorHandling(
        () => storage.updateDaoProposal(proposalId, {
          status: 'executed',
        }),
        {
          operation: 'updateDaoProposal',
          userId: req.user.userId,
          entityType: 'dao_proposal',
          entityId: proposalId,
        }
      );

      // Confirm blockchain transaction tracking
      blockchainTxTracker.confirm(trackingId);

      logger.info('Proposal executed successfully', { 
        proposalId,
        txHash: executeResult.txHash,
        trackingId,
      });

      res.json({
        ...updatedProposal,
        executeTxHash: executeResult.txHash,
      });
    } catch (error) {
      // Clear blockchain transaction tracking on error
      blockchainTxTracker.clear(trackingId);
      
      handleError(error, res, {
        operation: 'executeProposal',
        userId: req.user?.userId,
        entityType: 'dao_proposal',
        entityId: proposalId,
        requestId: req.id,
      });
    }
  });

  return router;
}
