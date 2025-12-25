/**
 * Marketplace Catalog Service
 * Handles asset listing, search, and discovery
 */

import { Router } from 'express';
import { db } from '../db';
import { marketplaceAssets } from '@shared/schema';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';

export const catalogRouter = Router();

// List assets with filtering
catalogRouter.get('/', async (req, res) => {
  try {
    const { 
      type, 
      authorWallet, 
      category,
      tag, 
      q, 
      page = '1', 
      limit = '20',
      sort = 'newest'
    } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const offset = (pageNum - 1) * limitNum;
    
    // Build base query
    const items = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.status, 'published'))
      .orderBy(sort === 'price_asc' 
        ? marketplaceAssets.priceUsd 
        : sort === 'price_desc'
        ? desc(marketplaceAssets.priceUsd)
        : desc(marketplaceAssets.createdAt)
      )
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
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// Get single asset by ID
catalogRouter.get('/:id', async (req, res) => {
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

// Get assets by author
catalogRouter.get('/author/:wallet', async (req, res) => {
  try {
    const items = await db
      .select()
      .from(marketplaceAssets)
      .where(and(
        eq(marketplaceAssets.authorWallet, req.params.wallet.toLowerCase()),
        eq(marketplaceAssets.status, 'published')
      ))
      .orderBy(desc(marketplaceAssets.createdAt))
      .limit(100);
    
    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch author assets' });
  }
});

// Get assets by type (ebook, track, video, etc.)
catalogRouter.get('/type/:type', async (req, res) => {
  try {
    const items = await db
      .select()
      .from(marketplaceAssets)
      .where(and(
        eq(marketplaceAssets.type, req.params.type),
        eq(marketplaceAssets.status, 'published')
      ))
      .orderBy(desc(marketplaceAssets.createdAt))
      .limit(50);
    
    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets by type' });
  }
});

// Search assets
catalogRouter.get('/search', async (req, res) => {
  try {
    const { q, type, limit = '20' } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const items = await db
      .select()
      .from(marketplaceAssets)
      .where(and(
        eq(marketplaceAssets.status, 'published'),
        or(
          like(marketplaceAssets.title, `%${q}%`),
          like(marketplaceAssets.description, `%${q}%`)
        )
      ))
      .orderBy(desc(marketplaceAssets.createdAt))
      .limit(Math.min(50, parseInt(limit as string) || 20));
    
    res.json({ items, query: q, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Featured/trending assets
catalogRouter.get('/featured', async (req, res) => {
  try {
    const items = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.status, 'published'))
      .orderBy(desc(marketplaceAssets.totalDownloads))
      .limit(12);
    
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured' });
  }
});
