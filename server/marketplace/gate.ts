/**
 * Marketplace Gate Service
 * Handles licensing, access control, and decrypt token issuance
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { marketplaceAssets, marketplaceLicenses, marketplaceReceipts, streamBatches, settleModes } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { processSettlement, anchorOnBase, type SettleMode } from './settlement';

export const gateRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'p3-gate-secret';
const ANCHOR_FEE_USD = 0.57;

const SettleModeEnum = z.enum(['BASE_USDC', 'BASE_DIRECT', 'RELAY_LZ', 'RELAY_WH']);

// Schemas
const CheckoutSchema = z.object({
  assetId: z.string().uuid(),
  appId: z.string().default('p3-marketplace'),
  anchor: z.boolean().default(true),
  settleMode: SettleModeEnum.default('BASE_USDC'),
  originChain: z.string().default('base'),
  feeCurrency: z.string().default('USDC'),
});

const BorrowSchema = z.object({
  assetId: z.string().uuid(),
  appId: z.string().default('p3-marketplace'),
  days: z.number().min(1).max(365),
  anchor: z.boolean().default(true),
  settleMode: SettleModeEnum.default('BASE_USDC'),
  originChain: z.string().default('base'),
  feeCurrency: z.string().default('USDC'),
});

const StreamSchema = z.object({
  assetId: z.string().uuid(),
  appId: z.string().default('p3-marketplace'),
  anchor: z.boolean().default(true),
  settleMode: SettleModeEnum.default('BASE_USDC'),
  originChain: z.string().default('base'),
  feeCurrency: z.string().default('USDC'),
});

// Helpers
function issueToken(payload: { licenseId: string; assetId: string }, expSec: number = 1800): string {
  const jti = uuid();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: expSec });
}

function computeDigest(data: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function getWallet(req: any): string | null {
  const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
  if (!wallet || typeof wallet !== 'string') return null;
  return wallet.toLowerCase();
}

// Policy checks
function ensurePurchasable(asset: any): void {
  if (!asset || asset.status !== 'published') {
    throw new Error('Asset not available for purchase');
  }
}

function ensureBorrowable(asset: any): void {
  if (!asset || asset.status !== 'published') {
    throw new Error('Asset not available for borrowing');
  }
  if (!['lend_days', 'perpetual'].includes(asset.policy)) {
    throw new Error('Asset does not support borrowing');
  }
}

// Checkout (purchase)
gateRouter.post('/checkout', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const { assetId, appId, anchor, settleMode, originChain, feeCurrency } = CheckoutSchema.parse(req.body);
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);
    
    ensurePurchasable(asset);
    
    // Check existing license
    const [existing] = await db
      .select()
      .from(marketplaceLicenses)
      .where(and(
        eq(marketplaceLicenses.assetId, assetId),
        eq(marketplaceLicenses.buyerWallet, wallet),
        eq(marketplaceLicenses.status, 'active')
      ))
      .limit(1);
    
    if (existing) {
      const decryptToken = issueToken({ licenseId: existing.id, assetId });
      return res.json({ licenseId: existing.id, decryptToken, existing: true });
    }
    
    // Create new license with settlement info
    const [license] = await db.insert(marketplaceLicenses).values({
      assetId,
      buyerWallet: wallet,
      appId,
      policy: asset.policy,
      status: 'active',
      pricePaidUsd: asset.priceUsd,
      settleMode,
      originChain,
      feeCurrency,
      relayStatus: 'pending',
    }).returning();
    
    // Process settlement before issuing decrypt token
    const settlementResult = await processSettlement({
      licenseId: license.id,
      assetId,
      buyerWallet: wallet,
      authorWallet: asset.authorWallet,
      amountUsd: parseFloat(asset.priceUsd?.toString() || '0'),
      settleMode: settleMode as SettleMode,
      originChain,
      feeCurrency,
    });
    
    if (!settlementResult.success) {
      await db
        .update(marketplaceLicenses)
        .set({ status: 'pending', relayStatus: 'failed' })
        .where(eq(marketplaceLicenses.id, license.id));
      return res.status(400).json({ 
        error: 'Settlement failed', 
        details: settlementResult.error,
        licenseId: license.id 
      });
    }
    
    const decryptToken = issueToken({ licenseId: license.id, assetId });
    
    // Update stats
    await db
      .update(marketplaceAssets)
      .set({ totalDownloads: sql`${marketplaceAssets.totalDownloads} + 1` })
      .where(eq(marketplaceAssets.id, assetId));
    
    // Anchor receipt on Base
    if (anchor) {
      await anchorOnBase({
        eventType: 'checkout',
        assetId,
        buyerWallet: wallet,
        authorWallet: asset.authorWallet,
        appId,
        settleMode: settleMode as SettleMode,
        originChain,
        txHashBase: settlementResult.txHashBase,
      });
    }
    
    res.json({ 
      licenseId: license.id, 
      decryptToken,
      settlement: {
        mode: settleMode,
        originChain,
        txHashBase: settlementResult.txHashBase,
        relayStatus: settlementResult.relayStatus,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Checkout failed' });
  }
});

// Borrow (time-limited)
gateRouter.post('/borrow', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const { assetId, appId, days, anchor, settleMode, originChain, feeCurrency } = BorrowSchema.parse(req.body);
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);
    
    ensureBorrowable(asset);
    
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    
    const [license] = await db.insert(marketplaceLicenses).values({
      assetId,
      buyerWallet: wallet,
      appId,
      policy: 'lend_days',
      expiresAt,
      status: 'active',
      pricePaidUsd: asset.priceUsd,
      settleMode,
      originChain,
      feeCurrency,
      relayStatus: 'pending',
    }).returning();
    
    // Process settlement before issuing decrypt token
    const settlementResult = await processSettlement({
      licenseId: license.id,
      assetId,
      buyerWallet: wallet,
      authorWallet: asset.authorWallet,
      amountUsd: parseFloat(asset.priceUsd?.toString() || '0'),
      settleMode: settleMode as SettleMode,
      originChain,
      feeCurrency,
    });
    
    if (!settlementResult.success) {
      await db
        .update(marketplaceLicenses)
        .set({ status: 'pending', relayStatus: 'failed' })
        .where(eq(marketplaceLicenses.id, license.id));
      return res.status(400).json({ 
        error: 'Settlement failed', 
        details: settlementResult.error,
        licenseId: license.id 
      });
    }
    
    const decryptToken = issueToken({ licenseId: license.id, assetId }, 1800);
    
    if (anchor) {
      await anchorOnBase({
        eventType: 'borrow',
        assetId,
        buyerWallet: wallet,
        authorWallet: asset.authorWallet,
        appId,
        settleMode: settleMode as SettleMode,
        originChain,
        txHashBase: settlementResult.txHashBase,
      });
    }
    
    res.json({ 
      licenseId: license.id, 
      expiresAt, 
      decryptToken,
      settlement: {
        mode: settleMode,
        originChain,
        txHashBase: settlementResult.txHashBase,
        relayStatus: settlementResult.relayStatus,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Borrow failed' });
  }
});

// Stream (music/video)
gateRouter.post('/stream', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const { assetId, appId, anchor, settleMode, originChain, feeCurrency } = StreamSchema.parse(req.body);
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);
    
    ensurePurchasable(asset);
    
    // Check or create license for streaming
    let [license] = await db
      .select()
      .from(marketplaceLicenses)
      .where(and(
        eq(marketplaceLicenses.assetId, assetId),
        eq(marketplaceLicenses.buyerWallet, wallet),
        eq(marketplaceLicenses.status, 'active')
      ))
      .limit(1);
    
    let settlementResult = null;
    
    if (!license) {
      [license] = await db.insert(marketplaceLicenses).values({
        assetId,
        buyerWallet: wallet,
        appId,
        policy: 'stream_ppv',
        status: 'active',
        pricePaidUsd: asset.priceUsd,
        settleMode,
        originChain,
        feeCurrency,
        relayStatus: 'pending',
      }).returning();
      
      // Process settlement for new license
      settlementResult = await processSettlement({
        licenseId: license.id,
        assetId,
        buyerWallet: wallet,
        authorWallet: asset.authorWallet,
        amountUsd: parseFloat(asset.priceUsd?.toString() || '0'),
        settleMode: settleMode as SettleMode,
        originChain,
        feeCurrency,
      });
      
      if (!settlementResult.success) {
        await db
          .update(marketplaceLicenses)
          .set({ status: 'pending', relayStatus: 'failed' })
          .where(eq(marketplaceLicenses.id, license.id));
        return res.status(400).json({ 
          error: 'Settlement failed', 
          details: settlementResult.error,
          licenseId: license.id 
        });
      }
    }
    
    const playId = `${license.id}:${Date.now()}`;
    const decryptToken = issueToken({ licenseId: license.id, assetId }, 7200); // 2 hour window
    
    // Update stream count
    await db
      .update(marketplaceAssets)
      .set({ totalStreams: sql`${marketplaceAssets.totalStreams} + 1` })
      .where(eq(marketplaceAssets.id, assetId));
    
    // Batch anchoring for streams
    if (anchor) {
      const playDigest = computeDigest({ playId, assetId, wallet, ts: Date.now() });
      
      // Find open batch or create new one
      const [openBatch] = await db
        .select()
        .from(streamBatches)
        .where(and(
          eq(streamBatches.assetId, assetId),
          eq(streamBatches.status, 'open')
        ))
        .limit(1);
      
      if (openBatch) {
        const digests = (openBatch.playDigests as string[]) || [];
        digests.push(playDigest);
        
        await db
          .update(streamBatches)
          .set({ 
            playCount: sql`${streamBatches.playCount} + 1`,
            playDigests: digests 
          })
          .where(eq(streamBatches.id, openBatch.id));
        
        // Close batch at 50 plays
        if (digests.length >= 50) {
          const batchDigest = computeDigest({ batchId: openBatch.id, digests });
          await db
            .update(streamBatches)
            .set({ status: 'closed', batchDigest, closedAt: new Date() })
            .where(eq(streamBatches.id, openBatch.id));
          
          await db.insert(marketplaceReceipts).values({
            eventType: 'stream',
            assetId,
            authorWallet: asset.authorWallet,
            appId,
            digest: batchDigest,
            batchId: openBatch.id,
            batchDigests: digests,
            status: 'submitted',
          });
        }
      } else {
        await db.insert(streamBatches).values({
          appId,
          assetId,
          authorWallet: asset.authorWallet,
          playCount: 1,
          playDigests: [playDigest],
          status: 'open',
        });
      }
    }
    
    const response: Record<string, unknown> = { playId, decryptToken };
    if (settlementResult) {
      response.settlement = {
        mode: settleMode,
        originChain,
        txHashBase: settlementResult.txHashBase,
        relayStatus: settlementResult.relayStatus,
      };
    }
    
    res.json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Stream failed' });
  }
});

// Get license status
gateRouter.get('/license/:id', async (req, res) => {
  try {
    const [license] = await db
      .select()
      .from(marketplaceLicenses)
      .where(eq(marketplaceLicenses.id, req.params.id))
      .limit(1);
    
    if (!license) {
      return res.status(404).json({ error: 'License not found' });
    }
    
    // Check expiry
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      await db
        .update(marketplaceLicenses)
        .set({ status: 'expired' })
        .where(eq(marketplaceLicenses.id, license.id));
      license.status = 'expired';
    }
    
    res.json({ 
      id: license.id,
      status: license.status, 
      policy: license.policy, 
      expiresAt: license.expiresAt 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get license' });
  }
});

// Verify token endpoint
gateRouter.post('/verify', (req, res) => {
  try {
    const { token } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, claims: decoded });
  } catch {
    res.json({ valid: false });
  }
});

export function verifyToken(token: string): { licenseId: string; assetId: string; jti: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}
