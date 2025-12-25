/**
 * P3 Marketplace Service
 * Multi-vertical marketplace for ebooks, music, video, art, games, data, courses
 * 
 * Production features:
 * - Encrypted content (XChaCha20-Poly1305 envelopes)
 * - IPFS pinning via Pinata
 * - Cloudflare R2 signed URLs for delivery
 * - Ethereum anchor contract for receipts
 * - BullMQ for async anchor jobs
 * - Treasury with splits and sponsorship
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  marketplaceAssets, 
  insertMarketplaceAssetSchema 
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';

// Import sub-routers
import { catalogRouter } from './catalog';
import { gateRouter } from './gate';
import { contentRouter } from './content';
import { treasuryRouter } from './treasury';
import { explorerRouter } from './explorer';
import { manifestRouter } from './manifest';
import { settlementRouter } from './settlement';
import pwaRouter from '../routes/marketplace-pwa';

export const marketplaceRouter = Router();

// Health check
marketplaceRouter.get('/health', (_req, res) => {
  res.json({ 
    ok: true, 
    service: 'p3-marketplace',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount sub-routers
marketplaceRouter.use('/catalog', catalogRouter);
marketplaceRouter.use('/gate', gateRouter);
marketplaceRouter.use('/content', contentRouter);
marketplaceRouter.use('/treasury', treasuryRouter);
marketplaceRouter.use('/explorer', explorerRouter);
marketplaceRouter.use('/manifest', manifestRouter);
marketplaceRouter.use('/settlement', settlementRouter);
marketplaceRouter.use('/pwa', pwaRouter);

// ============================================================================
// Asset Management (Author endpoints)
// ============================================================================

const CreateAssetSchema = z.object({
  type: z.enum(['ebook', 'track', 'album', 'video', 'course', 'game', 'dataset', 'art']),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).default(''),
  tags: z.array(z.string()).max(20).default([]),
  priceUsd: z.number().min(0).max(100000),
  policy: z.enum(['perpetual', 'lend_days', 'stream_ppv', 'rent_hours', 'subscription']).default('perpetual'),
  split: z.object({
    authorPct: z.number().min(0).max(100).default(85),
    marketplacePct: z.number().min(0).max(100).default(10),
    sponsorPct: z.number().min(0).max(100).default(5),
  }).optional(),
  envelope: z.object({
    alg: z.string().default('xchacha20-poly1305'),
    version: z.string().default('1.0'),
  }).optional(),
  editionTotal: z.number().min(1).optional(),
  category: z.string().optional(),
  coverUrl: z.string().optional(),
  previewUrl: z.string().optional(),
});

// Create new asset
marketplaceRouter.post('/assets', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const body = CreateAssetSchema.parse(req.body);
    const split = body.split || { authorPct: 85, marketplacePct: 10, sponsorPct: 5 };
    
    // Validate split totals
    if (split.authorPct + split.marketplacePct + split.sponsorPct !== 100) {
      return res.status(400).json({ error: 'Split must total 100%' });
    }
    
    const [asset] = await db.insert(marketplaceAssets).values({
      type: body.type,
      authorWallet: wallet.toLowerCase(),
      title: body.title,
      description: body.description,
      tags: body.tags,
      priceUsd: String(body.priceUsd),
      policy: body.policy,
      splitAuthorPct: split.authorPct,
      splitMarketplacePct: split.marketplacePct,
      splitSponsorPct: split.sponsorPct,
      encryptionAlg: body.envelope?.alg || 'xchacha20-poly1305',
      envelopeVersion: body.envelope?.version || '1.0',
      editionTotal: body.editionTotal,
      category: body.category,
      coverUrl: body.coverUrl,
      previewUrl: body.previewUrl,
      status: 'draft',
    }).returning();
    
    res.json({ 
      assetId: asset.id, 
      status: 'draft',
      message: 'Asset created. Upload content to publish.' 
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// Update asset
marketplaceRouter.patch('/assets/:id', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, req.params.id))
      .limit(1);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    if (asset.authorWallet !== wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const allowedFields = ['title', 'description', 'tags', 'priceUsd', 'policy', 'category', 'coverUrl', 'previewUrl'];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'priceUsd') {
          updates[field] = String(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }
    
    const [updated] = await db
      .update(marketplaceAssets)
      .set(updates)
      .where(eq(marketplaceAssets.id, req.params.id))
      .returning();
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// Publish asset (after content upload)
marketplaceRouter.post('/assets/:id/publish', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, req.params.id))
      .limit(1);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    if (asset.authorWallet !== wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Verify content is uploaded
    if (!asset.ipfsCidEnc && !asset.r2Key) {
      return res.status(400).json({ error: 'Content must be uploaded before publishing' });
    }
    
    const [updated] = await db
      .update(marketplaceAssets)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(marketplaceAssets.id, req.params.id))
      .returning();
    
    res.json({ assetId: updated.id, status: 'published' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to publish asset' });
  }
});

// Unpublish asset
marketplaceRouter.post('/assets/:id/unpublish', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, req.params.id))
      .limit(1);
    
    if (!asset || asset.authorWallet !== wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await db
      .update(marketplaceAssets)
      .set({ status: 'unlisted', updatedAt: new Date() })
      .where(eq(marketplaceAssets.id, req.params.id));
    
    res.json({ assetId: req.params.id, status: 'unlisted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unpublish asset' });
  }
});

// Get my assets (author)
marketplaceRouter.get('/assets/mine', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const assets = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.authorWallet, wallet.toLowerCase()));
    
    res.json({ items: assets, total: assets.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get single asset
marketplaceRouter.get('/assets/:id', async (req, res) => {
  try {
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, req.params.id))
      .limit(1);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// Delete asset (soft delete)
marketplaceRouter.delete('/assets/:id', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, req.params.id))
      .limit(1);
    
    if (!asset || asset.authorWallet !== wallet.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await db
      .update(marketplaceAssets)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(marketplaceAssets.id, req.params.id));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// ============================================================================
// Stats and Analytics
// ============================================================================

marketplaceRouter.get('/stats', async (req, res) => {
  try {
    const assets = await db.select().from(marketplaceAssets);
    
    const stats = {
      totalAssets: assets.length,
      published: assets.filter(a => a.status === 'published').length,
      byType: {} as Record<string, number>,
      totalDownloads: assets.reduce((sum, a) => sum + (a.totalDownloads || 0), 0),
      totalStreams: assets.reduce((sum, a) => sum + (a.totalStreams || 0), 0),
    };
    
    for (const asset of assets) {
      stats.byType[asset.type] = (stats.byType[asset.type] || 0) + 1;
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default marketplaceRouter;
