/**
 * Marketplace Audit Service
 * Handles compliance exports and signed audit bundles
 */

import { Router } from 'express';
import { db } from '../db';
import { marketplaceReceipts, marketplaceAssets, type MarketplaceReceipt } from '@shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import crypto from 'crypto';

export const auditRouter = Router();

// Sign bundle with HMAC
function signBundle(bundle: unknown): { digest: string; signature: string } {
  const bundleStr = JSON.stringify(bundle);
  const digest = crypto.createHash('sha256').update(bundleStr).digest('hex');
  const secret = process.env.AUDIT_SIGNING_SECRET || 'p3-audit-signing';
  const signature = crypto
    .createHmac('sha256', secret)
    .update(digest)
    .digest('hex');
  
  return { digest, signature };
}

// Export receipts bundle
auditRouter.post('/export', async (req, res) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet required' });
    }
    
    const { 
      scope = 'all', 
      from, 
      to, 
      authorId,
      format = 'json' 
    } = req.body;
    
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    
    // Build query conditions
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .where(and(
        gte(marketplaceReceipts.createdAt, fromDate),
        lte(marketplaceReceipts.createdAt, toDate)
      ))
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(10000);
    
    // Filter by scope
    let filtered = receipts;
    if (scope !== 'all') {
      const scopeTypeMap: Record<string, string[]> = {
        'ebooks': ['checkout', 'borrow'],
        'music': ['stream'],
        'video': ['stream', 'rent'],
        'art': ['checkout'],
      };
      const types = scopeTypeMap[scope] || [];
      if (types.length > 0) {
        filtered = receipts.filter((r: MarketplaceReceipt) => types.includes(r.eventType));
      }
    }
    
    // Build bundle
    const bundle = {
      scope,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      exportedAt: new Date().toISOString(),
      exportedBy: wallet.toLowerCase(),
      count: filtered.length,
      receipts: filtered.map((r: MarketplaceReceipt) => ({
        id: r.id,
        eventType: r.eventType,
        assetId: r.assetId,
        digest: r.digest,
        txHash: r.txHash,
        blockNumber: r.blockNumber,
        status: r.status,
        createdAt: r.createdAt,
      })),
    };
    
    const { digest, signature } = signBundle(bundle);
    
    if (format === 'csv') {
      // Return CSV format
      const headers = ['id', 'eventType', 'assetId', 'digest', 'txHash', 'blockNumber', 'status', 'createdAt'];
      const rows = filtered.map((r: MarketplaceReceipt) => [
        r.id,
        r.eventType,
        r.assetId || '',
        r.digest,
        r.txHash || '',
        r.blockNumber?.toString() || '',
        r.status,
        r.createdAt?.toISOString() || '',
      ].join(','));
      
      const csv = [headers.join(','), ...rows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-${digest.slice(0, 8)}.csv"`);
      return res.send(csv);
    }
    
    res.json({
      bundle,
      digest,
      signature,
      downloadUrl: `/api/marketplace/audit/download/${digest}`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Export by author
auditRouter.get('/author/:wallet', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to as string) : new Date();
    
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .where(and(
        eq(marketplaceReceipts.authorWallet, req.params.wallet.toLowerCase()),
        gte(marketplaceReceipts.createdAt, fromDate),
        lte(marketplaceReceipts.createdAt, toDate)
      ))
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(1000);
    
    const bundle = {
      authorWallet: req.params.wallet.toLowerCase(),
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      count: receipts.length,
      receipts,
    };
    
    const { digest, signature } = signBundle(bundle);
    
    res.json({ bundle, digest, signature });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Export by asset
auditRouter.get('/asset/:assetId', async (req, res) => {
  try {
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.assetId, req.params.assetId))
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(1000);
    
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, req.params.assetId))
      .limit(1);
    
    const bundle = {
      asset: asset ? {
        id: asset.id,
        type: asset.type,
        title: asset.title,
        authorWallet: asset.authorWallet,
      } : null,
      count: receipts.length,
      receipts,
    };
    
    const { digest, signature } = signBundle(bundle);
    
    res.json({ bundle, digest, signature });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Verify audit bundle
auditRouter.post('/verify', async (req, res) => {
  try {
    const { bundle, digest, signature } = req.body;
    
    if (!bundle || !digest || !signature) {
      return res.status(400).json({ error: 'Bundle, digest, and signature required' });
    }
    
    // Recompute digest
    const bundleStr = JSON.stringify(bundle);
    const computedDigest = crypto.createHash('sha256').update(bundleStr).digest('hex');
    
    if (computedDigest !== digest) {
      return res.json({ valid: false, reason: 'Digest mismatch - bundle may have been modified' });
    }
    
    // Verify signature
    const secret = process.env.AUDIT_SIGNING_SECRET || 'p3-audit-signing';
    const computedSig = crypto
      .createHmac('sha256', secret)
      .update(digest)
      .digest('hex');
    
    if (computedSig !== signature) {
      return res.json({ valid: false, reason: 'Invalid signature' });
    }
    
    res.json({ valid: true, digest, count: bundle.count });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get compliance summary
auditRouter.get('/summary', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string) || 30;
    const fromDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .where(gte(marketplaceReceipts.createdAt, fromDate));
    
    const summary = {
      period: { days: daysNum, from: fromDate.toISOString(), to: new Date().toISOString() },
      totalReceipts: receipts.length,
      anchored: receipts.filter((r: MarketplaceReceipt) => r.status === 'confirmed').length,
      pending: receipts.filter((r: MarketplaceReceipt) => ['queued', 'submitted'].includes(r.status)).length,
      failed: receipts.filter((r: MarketplaceReceipt) => r.status === 'failed').length,
      byType: {} as Record<string, number>,
      uniqueAssets: new Set(receipts.map((r: MarketplaceReceipt) => r.assetId).filter(Boolean)).size,
      uniqueBuyers: new Set(receipts.map((r: MarketplaceReceipt) => r.buyerWallet).filter(Boolean)).size,
      uniqueAuthors: new Set(receipts.map((r: MarketplaceReceipt) => r.authorWallet).filter(Boolean)).size,
    };
    
    for (const r of receipts) {
      summary.byType[r.eventType] = (summary.byType[r.eventType] || 0) + 1;
    }
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get summary' });
  }
});
