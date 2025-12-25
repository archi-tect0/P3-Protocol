/**
 * Marketplace Treasury Service
 * Handles splits, sponsorship, settlements, and payouts
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { treasuryConfigs, marketplaceLicenses, marketplaceSettlements, marketplaceAssets } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';

export const treasuryRouter = Router();

const ANCHOR_FEE_USD = 0.57;

// Schemas
const SponsorPolicySchema = z.object({
  payGas: z.boolean().default(false),
  payAnchorFees: z.boolean().default(false),
});

const SettlementSchema = z.object({
  periodStart: z.string().or(z.number()).transform(v => new Date(v)),
  periodEnd: z.string().or(z.number()).transform(v => new Date(v)),
});

function getWallet(req: any): string | null {
  const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
  if (!wallet || typeof wallet !== 'string') return null;
  return wallet.toLowerCase();
}

// Initialize author treasury
treasuryRouter.post('/init', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const { payoutWallet, sponsorPolicy, splitDefault } = req.body;
    
    const [existing] = await db
      .select()
      .from(treasuryConfigs)
      .where(eq(treasuryConfigs.authorWallet, wallet))
      .limit(1);
    
    if (existing) {
      return res.json({ authorId: existing.id, treasuryConfig: existing });
    }
    
    const [config] = await db.insert(treasuryConfigs).values({
      authorWallet: wallet,
      payoutWallet: payoutWallet || wallet,
      sponsorPayGas: sponsorPolicy?.payGas || false,
      sponsorPayAnchorFees: sponsorPolicy?.payAnchorFees || false,
      splitDefaultAuthor: splitDefault?.authorPct || 85,
      splitDefaultMarketplace: splitDefault?.marketplacePct || 10,
      splitDefaultSponsor: splitDefault?.sponsorPct || 5,
    }).returning();
    
    res.json({ authorId: config.id, treasuryConfig: config });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize treasury' });
  }
});

// Update sponsor policy
treasuryRouter.post('/policy', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const policy = SponsorPolicySchema.parse(req.body);
    
    const [updated] = await db
      .update(treasuryConfigs)
      .set({ 
        sponsorPayGas: policy.payGas, 
        sponsorPayAnchorFees: policy.payAnchorFees,
        updatedAt: new Date()
      })
      .where(eq(treasuryConfigs.authorWallet, wallet))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: 'Treasury config not found' });
    }
    
    res.json({ authorWallet: wallet, sponsorPolicy: policy });
  } catch (error) {
    res.status(400).json({ error: 'Failed to update policy' });
  }
});

// Get statement
treasuryRouter.get('/statement', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const [config] = await db
      .select()
      .from(treasuryConfigs)
      .where(eq(treasuryConfigs.authorWallet, wallet))
      .limit(1);
    
    if (!config) {
      return res.status(404).json({ error: 'Treasury config not found' });
    }
    
    // Get recent settlements
    const settlements = await db
      .select()
      .from(marketplaceSettlements)
      .where(eq(marketplaceSettlements.authorWallet, wallet))
      .orderBy(desc(marketplaceSettlements.createdAt))
      .limit(10);
    
    res.json({
      totalEarned: config.totalEarnedUsd,
      totalPaidOut: config.totalPaidOutUsd,
      pending: config.pendingPayoutUsd,
      settlementCadence: config.settlementCadence,
      recentSettlements: settlements,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get statement' });
  }
});

// Compute settlement (admin only)
treasuryRouter.post('/compute', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const { periodStart, periodEnd } = SettlementSchema.parse(req.body);
    
    // Get author's assets
    const assets = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.authorWallet, wallet));
    
    const assetIds = assets.map(a => a.id);
    
    // Get licenses in period
    const licenses = await db
      .select()
      .from(marketplaceLicenses)
      .where(and(
        gte(marketplaceLicenses.createdAt, periodStart),
        lte(marketplaceLicenses.createdAt, periodEnd)
      ));
    
    // Filter to author's assets and compute totals
    const relevantLicenses = licenses.filter(l => assetIds.includes(l.assetId));
    
    let grossRevenue = 0;
    let authorShare = 0;
    let marketplaceShare = 0;
    let anchorFees = 0;
    
    for (const license of relevantLicenses) {
      const price = parseFloat(license.pricePaidUsd?.toString() || '0');
      const asset = assets.find(a => a.id === license.assetId);
      
      if (asset) {
        grossRevenue += price + ANCHOR_FEE_USD;
        authorShare += price * (asset.splitAuthorPct / 100);
        marketplaceShare += price * (asset.splitMarketplacePct / 100);
        anchorFees += ANCHOR_FEE_USD;
      }
    }
    
    res.json({
      periodStart,
      periodEnd,
      transactionCount: relevantLicenses.length,
      grossRevenue,
      authorShare,
      marketplaceShare,
      anchorFees,
      netPayout: authorShare,
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to compute settlement' });
  }
});

// Execute settlement (admin only)
treasuryRouter.post('/settle', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const { periodStart, periodEnd } = SettlementSchema.parse(req.body);
    
    // Compute totals
    const totals = {
      gross: 0,
      author: 0,
      marketplace: 0,
      anchor: 0,
    };
    
    // Create settlement record
    const [settlement] = await db.insert(marketplaceSettlements).values({
      authorWallet: wallet,
      periodStart,
      periodEnd,
      totalGrossUsd: String(totals.gross),
      authorPayoutUsd: String(totals.author),
      marketplaceFeeUsd: String(totals.marketplace),
      anchorFeesPaidUsd: String(totals.anchor),
      status: 'pending',
    }).returning();
    
    // TODO: Execute on-chain payout
    // TODO: Anchor payout receipt
    
    res.json({
      settlementId: settlement.id,
      totals,
      status: 'pending',
      anchorQueued: true,
    });
  } catch (error) {
    res.status(400).json({ error: 'Settlement failed' });
  }
});

// Get config
treasuryRouter.get('/config', async (req, res) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) return res.status(401).json({ error: 'Wallet required' });
    
    const [config] = await db
      .select()
      .from(treasuryConfigs)
      .where(eq(treasuryConfigs.authorWallet, wallet))
      .limit(1);
    
    if (!config) {
      return res.status(404).json({ error: 'Treasury not initialized' });
    }
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get config' });
  }
});
