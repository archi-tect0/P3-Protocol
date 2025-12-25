/**
 * Marketplace Explorer Service
 * Public feed of anchored receipts and proofs
 */

import { Router } from 'express';
import { db } from '../db';
import { marketplaceReceipts, marketplaceAssets } from '@shared/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

export const explorerRouter = Router();

// Public feed of receipts
explorerRouter.get('/feed', async (req, res) => {
  try {
    const { 
      assetId, 
      authorWallet, 
      buyerWallet,
      eventType,
      status,
      from,
      to,
      page = '1', 
      limit = '50' 
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;
    
    const items = await db
      .select()
      .from(marketplaceReceipts)
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(limitNum)
      .offset(offset);
    
    res.json({ 
      items, 
      page: pageNum, 
      limit: limitNum,
      total: items.length,
      hasMore: items.length === limitNum 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Get receipt by ID
explorerRouter.get('/receipt/:id', async (req, res) => {
  try {
    const [receipt] = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.id, req.params.id))
      .limit(1);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Include asset details
    let asset = null;
    if (receipt.assetId) {
      [asset] = await db
        .select({
          id: marketplaceAssets.id,
          type: marketplaceAssets.type,
          title: marketplaceAssets.title,
          authorWallet: marketplaceAssets.authorWallet,
        })
        .from(marketplaceAssets)
        .where(eq(marketplaceAssets.id, receipt.assetId))
        .limit(1);
    }
    
    res.json({ receipt, asset });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// Get receipts by asset
explorerRouter.get('/asset/:assetId', async (req, res) => {
  try {
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.assetId, req.params.assetId))
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(100);
    
    res.json({ items: receipts, total: receipts.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Get receipts by author
explorerRouter.get('/author/:wallet', async (req, res) => {
  try {
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.authorWallet, req.params.wallet.toLowerCase()))
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(100);
    
    res.json({ items: receipts, total: receipts.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Get receipts by buyer
explorerRouter.get('/buyer/:wallet', async (req, res) => {
  try {
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .where(eq(marketplaceReceipts.buyerWallet, req.params.wallet.toLowerCase()))
      .orderBy(desc(marketplaceReceipts.createdAt))
      .limit(100);
    
    res.json({ items: receipts, total: receipts.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Verify receipt digest
explorerRouter.post('/verify', async (req, res) => {
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
    
    res.json({
      valid: true,
      found: true,
      receipt: {
        id: receipt.id,
        eventType: receipt.eventType,
        status: receipt.status,
        txHash: receipt.txHash,
        blockNumber: receipt.blockNumber,
        confirmations: receipt.confirmations,
        createdAt: receipt.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Stats endpoint
explorerRouter.get('/stats', async (req, res) => {
  try {
    const receipts = await db
      .select()
      .from(marketplaceReceipts)
      .limit(10000);
    
    const stats = {
      totalReceipts: receipts.length,
      confirmed: receipts.filter(r => r.status === 'confirmed').length,
      submitted: receipts.filter(r => r.status === 'submitted').length,
      failed: receipts.filter(r => r.status === 'failed').length,
      byType: {} as Record<string, number>,
    };
    
    for (const r of receipts) {
      stats.byType[r.eventType] = (stats.byType[r.eventType] || 0) + 1;
    }
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});
