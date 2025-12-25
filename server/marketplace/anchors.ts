/**
 * Marketplace Anchors Service
 * Handles blockchain anchoring for receipts using BullMQ and ethers.js
 */

import { Router } from 'express';
import { db } from '../db';
import { marketplaceReceipts, type MarketplaceReceipt } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { ethers } from 'ethers';
import crypto from 'crypto';

export const anchorsRouter = Router();

// Anchor contract ABI (minimal)
const ANCHOR_ABI = [
  'function anchor(bytes32 digest, string calldata eventType) external',
  'event Anchored(bytes32 digest, address indexed actor, uint256 ts, string eventType)'
];

// Get provider and wallet (lazy init)
let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let anchorContract: ethers.Contract | null = null;

function getAnchorContract(): ethers.Contract | null {
  if (anchorContract) return anchorContract;
  
  const rpcUrl = process.env.RPC_URL_BASE_MAINNET || process.env.RPC_URL_MAINNET;
  const privateKey = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const contractAddress = process.env.ANCHOR_CONTRACT_ADDRESS;
  
  if (!rpcUrl || !privateKey || !contractAddress) {
    return null;
  }
  
  provider = new ethers.JsonRpcProvider(rpcUrl);
  wallet = new ethers.Wallet(privateKey, provider);
  anchorContract = new ethers.Contract(contractAddress, ANCHOR_ABI, wallet);
  
  return anchorContract;
}

// Compute SHA256 digest
export function computeDigest(data: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// Submit anchor to blockchain
async function submitAnchor(receipt: typeof marketplaceReceipts.$inferSelect): Promise<{ txHash: string; blockNumber?: number }> {
  const contract = getAnchorContract();
  
  if (!contract) {
    // No blockchain config - mark as pending
    return { txHash: `pending:${receipt.id}` };
  }
  
  try {
    const digestBytes = ethers.getBytes(`0x${receipt.digest}`);
    const tx = await contract.anchor(digestBytes, receipt.eventType);
    const txReceipt = await tx.wait(1);
    
    return {
      txHash: tx.hash,
      blockNumber: txReceipt.blockNumber,
    };
  } catch (error) {
    console.error('Anchor submission failed:', error);
    throw error;
  }
}

// Queue anchor for submission
export async function enqueueAnchor(eventType: string, payload: {
  assetId?: string;
  buyerWallet?: string;
  authorWallet?: string;
  appId: string;
  [key: string]: unknown;
}): Promise<string> {
  const digest = computeDigest({ eventType, ...payload, ts: Date.now() });
  
  // Check idempotency
  const [existing] = await db
    .select()
    .from(marketplaceReceipts)
    .where(eq(marketplaceReceipts.digest, digest))
    .limit(1);
  
  if (existing) {
    return existing.id;
  }
  
  // Create receipt record
  const [receipt] = await db.insert(marketplaceReceipts).values({
    eventType,
    assetId: payload.assetId,
    buyerWallet: payload.buyerWallet?.toLowerCase(),
    authorWallet: payload.authorWallet?.toLowerCase(),
    appId: payload.appId,
    digest,
    status: 'queued',
  }).returning();
  
  // In production, this would be handled by BullMQ worker
  // For now, attempt immediate submission
  try {
    const result = await submitAnchor(receipt);
    
    await db
      .update(marketplaceReceipts)
      .set({
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        status: result.blockNumber ? 'confirmed' : 'submitted',
      })
      .where(eq(marketplaceReceipts.id, receipt.id));
  } catch (error) {
    await db
      .update(marketplaceReceipts)
      .set({ status: 'failed' })
      .where(eq(marketplaceReceipts.id, receipt.id));
  }
  
  return receipt.id;
}

// API Routes

// Get anchor queue status
anchorsRouter.get('/queue', async (req, res) => {
  try {
    const queued = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.status, 'queued'))
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(100);
    
    const submitted = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.status, 'submitted'))
      .limit(100);
    
    res.json({
      queued: queued.length,
      submitted: submitted.length,
      items: [...queued, ...submitted],
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// Get anchor by ID
anchorsRouter.get('/:id', async (req, res) => {
  try {
    const [receipt] = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.id, req.params.id))
      .limit(1);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Anchor not found' });
    }
    
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get anchor' });
  }
});

// Verify anchor by digest
anchorsRouter.post('/verify', async (req, res) => {
  try {
    const { digest } = req.body;
    
    if (!digest) {
      return res.status(400).json({ error: 'Digest required' });
    }
    
    const [receipt] = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.digest, digest))
      .limit(1);
    
    if (!receipt) {
      return res.json({ valid: false, found: false });
    }
    
    // Could verify on-chain here
    res.json({
      valid: receipt.status === 'confirmed',
      found: true,
      receipt: {
        id: receipt.id,
        eventType: receipt.eventType,
        status: receipt.status,
        txHash: receipt.txHash,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Retry failed anchors (admin)
anchorsRouter.post('/retry', async (req, res) => {
  try {
    const failed = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.status, 'failed'))
      .limit(50);
    
    let retried = 0;
    
    for (const receipt of failed) {
      try {
        const result = await submitAnchor(receipt);
        
        await db
          .update(marketplaceReceipts)
          .set({
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            status: result.blockNumber ? 'confirmed' : 'submitted',
          })
          .where(eq(marketplaceReceipts.id, receipt.id));
        
        retried++;
      } catch {
        // Keep as failed
      }
    }
    
    res.json({ retried, total: failed.length });
  } catch (error) {
    res.status(500).json({ error: 'Retry failed' });
  }
});

// Stats
anchorsRouter.get('/stats', async (req, res) => {
  try {
    const all = await db.select().from(marketplaceReceipts).limit(10000);
    
    const stats = {
      total: all.length,
      confirmed: all.filter((r: MarketplaceReceipt) => r.status === 'confirmed').length,
      submitted: all.filter((r: MarketplaceReceipt) => r.status === 'submitted').length,
      queued: all.filter((r: MarketplaceReceipt) => r.status === 'queued').length,
      failed: all.filter((r: MarketplaceReceipt) => r.status === 'failed').length,
      byType: {} as Record<string, number>,
    };
    
    for (const r of all) {
      stats.byType[r.eventType] = (stats.byType[r.eventType] || 0) + 1;
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});
