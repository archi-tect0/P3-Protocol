import { Router } from 'express';
import { createError } from '../middleware/errors';
import { enqueueAnchors } from '../../anchor/queue';
import { db } from '../../db';
import { daoProposals, daoVotes } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

const router = Router();

let blockchainAvailable: boolean | null = null;

async function getBlockchainService() {
  if (blockchainAvailable === false) return null;
  
  try {
    if (!process.env.PRIVATE_KEY) {
      blockchainAvailable = false;
      return null;
    }
    const { getBaseSepoliaService } = await import('../../services/blockchain');
    const service = getBaseSepoliaService();
    blockchainAvailable = true;
    return service;
  } catch {
    blockchainAvailable = false;
    return null;
  }
}

router.get('/roles', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    const blockchain = await getBlockchainService();
    let votingPower = '0';
    
    if (blockchain) {
      try {
        votingPower = await blockchain.getVotingPower(wallet);
      } catch {
      }
    }

    const roles = req.sdkUser?.roles || ['user'];
    if (BigInt(votingPower) > BigInt(0)) {
      roles.push('voter');
    }

    res.json({ roles, votingPower });
  } catch (err) {
    next(err);
  }
});

router.post('/vote', async (req, res, next) => {
  try {
    const { proposalId, choice, anchor = false } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!proposalId || !choice) {
      throw createError('proposalId and choice required', 400, 'invalid_request');
    }

    const validChoices = ['for', 'against', 'abstain'];
    if (!validChoices.includes(choice)) {
      throw createError('Invalid choice. Must be: for, against, or abstain', 400, 'invalid_choice');
    }

    const [proposal] = await db.select().from(daoProposals)
      .where(eq(daoProposals.proposalId, proposalId))
      .limit(1);

    if (!proposal) {
      throw createError('Proposal not found', 404, 'not_found');
    }

    if (proposal.status !== 'active') {
      throw createError('Proposal is not active', 400, 'proposal_not_active');
    }

    const [existingVote] = await db.select().from(daoVotes)
      .where(and(
        eq(daoVotes.proposalId, proposal.id),
        eq(daoVotes.voter, wallet)
      ))
      .limit(1);

    if (existingVote) {
      throw createError('Already voted on this proposal', 400, 'already_voted');
    }

    let txHash: string | undefined;
    let votingPower = '1'; // Default weight when blockchain unavailable
    const blockchain = await getBlockchainService();

    if (blockchain) {
      try {
        const walletPower = await blockchain.getVotingPower(wallet);
        // Use wallet's voting power if > 0, otherwise default to 1
        votingPower = BigInt(walletPower) > BigInt(0) ? walletPower : '1';
        
        const voteResult = await blockchain.castVote(proposalId, choice as 'for' | 'against' | 'abstain');
        txHash = voteResult.txHash;
        // Use on-chain voting power if available
        if (BigInt(voteResult.votingPower) > BigInt(0)) {
          votingPower = voteResult.votingPower;
        }
      } catch {
        // Blockchain failed, keep default votingPower of '1'
      }
    }

    const shouldAnchor = anchor || !txHash;

    await db.insert(daoVotes).values({
      proposalId: proposal.id,
      voter: wallet,
      choice: choice as 'for' | 'against' | 'abstain',
      votingPower,
      txHash: txHash || null,
      anchorQueued: shouldAnchor && !txHash,
    });

    // Use SQL for atomic increment to prevent race conditions
    const { sql } = await import('drizzle-orm');
    // Ensure voteWeight is at least 1 for tallying
    const voteWeight = BigInt(votingPower) > BigInt(0) ? BigInt(votingPower) : BigInt(1);
    
    if (choice === 'for') {
      await db.execute(sql`
        UPDATE dao_proposals 
        SET votes_for = (COALESCE(votes_for::bigint, 0) + ${voteWeight.toString()})::text,
            updated_at = NOW()
        WHERE id = ${proposal.id}
      `);
    } else if (choice === 'against') {
      await db.execute(sql`
        UPDATE dao_proposals 
        SET votes_against = (COALESCE(votes_against::bigint, 0) + ${voteWeight.toString()})::text,
            updated_at = NOW()
        WHERE id = ${proposal.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE dao_proposals 
        SET votes_abstain = (COALESCE(votes_abstain::bigint, 0) + ${voteWeight.toString()})::text,
            updated_at = NOW()
        WHERE id = ${proposal.id}
      `);
    }

    let receiptId: string | undefined;
    if (shouldAnchor && !txHash) {
      await enqueueAnchors([{
        appId: 'dao',
        event: 'vote',
        data: { proposalId, choice, wallet, votingPower },
        ts: Date.now(),
      }]);
      receiptId = `vote-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    res.json({ 
      ok: true, 
      txHash,
      receiptId,
      onChain: !!txHash,
      queued: shouldAnchor && !txHash
    });
  } catch (err) {
    next(err);
  }
});

router.post('/proposals', async (req, res, next) => {
  try {
    const { status, limit = 50, syncOnChain = false } = req.body;

    let query = db.select().from(daoProposals).orderBy(desc(daoProposals.createdAt));

    if (status) {
      query = db.select().from(daoProposals)
        .where(eq(daoProposals.status, status))
        .orderBy(desc(daoProposals.createdAt));
    }

    const proposals = await query.limit(limit);

    let syncedProposals = proposals;

    if (syncOnChain) {
      const blockchain = await getBlockchainService();
      if (blockchain) {
        syncedProposals = await Promise.all(
          proposals.map(async (p) => {
            try {
              const onChainState = await blockchain.getProposalState(p.proposalId);
              if (onChainState !== p.status) {
                await db.update(daoProposals)
                  .set({ status: onChainState as typeof p.status, updatedAt: new Date() })
                  .where(eq(daoProposals.id, p.id));
                return { ...p, status: onChainState as typeof p.status };
              }
            } catch {
            }
            return p;
          })
        );
      }
    }

    res.json({
      proposals: syncedProposals.map(p => ({
        id: p.proposalId,
        title: p.title,
        description: p.description,
        proposer: p.proposer,
        status: p.status,
        votesFor: p.votesFor,
        votesAgainst: p.votesAgainst,
        votesAbstain: p.votesAbstain,
        startBlock: p.startBlock,
        endBlock: p.endBlock,
        eta: p.eta,
        txHash: p.txHash,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/delegate', async (req, res, next) => {
  try {
    const { to } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!to) {
      throw createError('Delegate address required', 400, 'invalid_request');
    }

    const blockchain = await getBlockchainService();
    
    if (blockchain) {
      try {
        const result = await blockchain.delegateVotes(to);
        return res.json({ 
          ok: true, 
          txHash: result.txHash,
          onChain: true
        });
      } catch {
      }
    }

    await enqueueAnchors([{
      appId: 'dao',
      event: 'delegate',
      data: { from: wallet, to },
      ts: Date.now(),
    }]);

    res.json({ 
      ok: true, 
      queued: true,
      onChain: false
    });
  } catch (err) {
    next(err);
  }
});

export default router;
