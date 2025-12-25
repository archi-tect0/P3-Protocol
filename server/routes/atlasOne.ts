/**
 * Atlas One API Router
 * 
 * Unified API surface for the Atlas One substrate marketplace.
 * Consolidates games, media, ebooks, apps, and products.
 * 
 * Routes:
 * - /api/atlas-one/catalog - Unified catalog operations
 * - /api/atlas-one/library - User library and access
 * - /api/atlas-one/commerce - Purchases, rentals, anchoring
 * - /api/atlas-one/sessions - User sessions and activity
 * - /api/atlas-one/intent - Voice command processing
 * - /api/atlas-one/lens - Manifest lenses for viewport rendering (Atlas API 2.0)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { marketplaceItems } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import {
  searchAtlasOne,
  getFeaturedItems,
  getItemsByKind,
  searchGames,
  searchOMDB,
  importFromOMDB,
  getEbookCatalog,
  importFromGoogleBooks,
  importFromOpenLibrary,
} from '../atlas/one/catalog/index';
import type { ExperienceKind } from '../atlas/one/types';
import {
  getContinueItems,
  getUnifiedLibrary,
  checkAccess,
  rentMedia,
  purchaseMedia,
  savePlaybackPosition,
  saveProgress,
  getProgress,
} from '../atlas/one/content/index';
import {
  purchaseItem,
  checkItemAccess,
  createReview,
  getReviewsForItem,
  getItemStats,
  anchorEventDirect,
  getEventAnchorStatus,
} from '../atlas/one/commerce/index';
import {
  getSessionStats,
  getRecentActivity,
} from '../atlas/one/sessions/index';
import {
  parseAtlasOneCommand,
  isAtlasOneCommand,
  getAtlasOneNLIntent,
  getAtlasOneFeature,
} from '../atlas/one/intent/index';
import {
  generateLens,
  generateCardLens,
  generateQuickviewLens,
  generatePlaybackLens,
  getDelta,
  getLensVersion,
  getViewportBatch,
  refreshLensForItem,
} from '../atlas/one/catalog/lensService';
import {
  pruneOldVersions,
  getLensStats,
  getDeltaHistory,
} from '../atlas/one/catalog/lensStore';
import lensRoutes from '../atlas/one/catalog/lensRoutes';
import escrowRoutes from '../atlas/one/receipts/escrowRoutes';
import type { LensType, ViewportBatchRequest, AtlasOneItem } from '../atlas/one/types';

const router = Router();

router.use('/lens', lensRoutes);
router.use('/escrow', escrowRoutes);

const logger = {
  info: (msg: string) => console.log(`[Atlas One] ${msg}`),
  error: (msg: string) => console.error(`[Atlas One] ${msg}`),
};

// =============================================================================
// CATALOG ENDPOINTS
// =============================================================================

function itemToLens(item: AtlasOneItem, lensType: LensType, version: number = 1) {
  const accessHint = item.priceWei === '0' ? 'free' : 'purchase';
  const metadata = item.metadata as Record<string, unknown> | undefined;
  
  const cardLens = {
    id: item.id,
    title: item.title,
    type: item.kind,
    art: item.thumbnail || item.coverImage,
    accessHint,
    version,
  };
  
  if (lensType === 'card') {
    return cardLens;
  }
  
  const quickviewLens = {
    ...cardLens,
    description: item.description,
    provider: (metadata?.provider as string) || (metadata?.developer as string) || item.creatorWallet,
    rating: item.rating,
    duration: undefined,
    pages: undefined,
    category: item.category,
    tags: item.tags,
  };
  
  if (lensType === 'quickview') {
    return quickviewLens;
  }
  
  const capabilities: string[] = [];
  if (item.priceWei === '0') capabilities.push('free');
  else capabilities.push('purchase');
  if (metadata?.stream) capabilities.push('stream');
  if (metadata?.download) capabilities.push('download');
  
  const chapters = (metadata?.chapters as Array<{ title: string; startTime?: number; startPage?: number; duration?: number }>) || undefined;
  
  return {
    ...quickviewLens,
    access: undefined,
    metadata: item.metadata,
    chapters,
    priceWei: item.priceWei,
    currency: item.currency,
    capabilities: capabilities.length > 0 ? capabilities : undefined,
  };
}

router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const { kind, category, search, featured, limit, offset, lens, version } = req.query;
    
    const result = await searchAtlasOne({
      kind: kind as ExperienceKind | undefined,
      category: category as string | undefined,
      search: search as string | undefined,
      featured: featured === 'true',
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      status: 'published',
    });

    if (lens && ['card', 'quickview', 'playback'].includes(lens as string)) {
      const lensType = lens as LensType;
      const lensItems = result.items.map(item => ({
        itemId: item.id,
        lens: itemToLens(item, lensType),
        version: 1,
      }));
      
      res.json({
        items: lensItems,
        count: result.count,
        lensType,
        filters: result.filters,
      });
      return;
    }

    res.json(result);
  } catch (err: any) {
    logger.error(`Catalog search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog/featured', async (req: Request, res: Response) => {
  try {
    const { lens } = req.query;
    const result = await getFeaturedItems(12);
    
    if (lens && ['card', 'quickview', 'playback'].includes(lens as string)) {
      const lensType = lens as LensType;
      const lensItems = result.items.map(item => ({
        itemId: item.id,
        lens: itemToLens(item, lensType),
        version: 1,
      }));
      
      res.json({
        items: lensItems,
        count: result.count,
        lensType,
        featured: true,
      });
      return;
    }
    
    res.json(result);
  } catch (err: any) {
    logger.error(`Featured items failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog/:kind', async (req: Request, res: Response) => {
  try {
    const { kind } = req.params;
    const { limit, offset, lens } = req.query;
    
    const result = await getItemsByKind(
      kind as ExperienceKind,
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );

    if (lens && ['card', 'quickview', 'playback'].includes(lens as string)) {
      const lensType = lens as LensType;
      const lensItems = result.items.map(item => ({
        itemId: item.id,
        lens: itemToLens(item, lensType),
        version: 1,
      }));
      
      res.json({
        items: lensItems,
        count: result.count,
        lensType,
        kind,
      });
      return;
    }

    res.json(result);
  } catch (err: any) {
    logger.error(`Items by kind failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog/games/search', async (req: Request, res: Response) => {
  try {
    const { search, genre, platform, source, limit } = req.query;
    
    const games = await searchGames({
      search: search as string | undefined,
      genre: genre as string | undefined,
      platform: platform as string | undefined,
      source: source as 'freetogame' | 'gamerpower' | undefined,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.json({ games, count: games.length });
  } catch (err: any) {
    logger.error(`Game search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog/media/search', async (req: Request, res: Response) => {
  try {
    const { title, type, year } = req.query;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await searchOMDB(
      title as string,
      type as 'movie' | 'series' | 'episode' | undefined,
      year as string | undefined
    );

    if (!result) {
      return res.status(404).json({ error: 'No results found' });
    }

    res.json(result);
  } catch (err: any) {
    logger.error(`Media search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/catalog/media/import', async (req: Request, res: Response) => {
  try {
    const { imdbId, priceWei, rentalPriceWei } = req.body;
    
    if (!imdbId) {
      return res.status(400).json({ error: 'IMDB ID is required' });
    }

    const item = await importFromOMDB(imdbId, priceWei || '0', rentalPriceWei);
    
    if (!item) {
      return res.status(404).json({ error: 'Could not import media' });
    }

    res.status(201).json(item);
  } catch (err: any) {
    logger.error(`Media import failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog/ebooks', async (req: Request, res: Response) => {
  try {
    const { category, search, limit, offset } = req.query;
    
    const result = await getEbookCatalog({
      category: category as string | undefined,
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json(result);
  } catch (err: any) {
    logger.error(`Ebook catalog failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog/ebooks/search/google', async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await importFromGoogleBooks(
      query as string,
      limit ? parseInt(limit as string) : 20
    );
    res.json(results);
  } catch (err: any) {
    logger.error(`Google Books search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/catalog/ebooks/search/openlibrary', async (req: Request, res: Response) => {
  try {
    const { subject, isbn, limit } = req.query;
    
    const results = await importFromOpenLibrary({
      subject: subject as string | undefined,
      isbn: isbn as string | undefined,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(results);
  } catch (err: any) {
    logger.error(`Open Library search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// LIBRARY ENDPOINTS
// =============================================================================

router.get('/library', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const { kind } = req.query;
    const result = await getUnifiedLibrary(wallet, kind as ExperienceKind | undefined);
    res.json(result);
  } catch (err: any) {
    logger.error(`Library fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/library/continue', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const { limit } = req.query;
    const items = await getContinueItems(wallet, limit ? parseInt(limit as string) : 10);
    res.json({ items, count: items.length });
  } catch (err: any) {
    logger.error(`Continue items failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/library/access/:itemId', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId } = req.params;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const result = await checkAccess(wallet, itemId);
    res.json(result);
  } catch (err: any) {
    logger.error(`Access check failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/library/progress/media', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId, position } = req.body;
    
    if (!wallet || !itemId) {
      return res.status(400).json({ error: 'Wallet and itemId required' });
    }

    const result = await savePlaybackPosition(wallet, itemId, position);
    res.json(result);
  } catch (err: any) {
    logger.error(`Media progress save failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/library/progress/ebook', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId, currentPage, totalPages } = req.body;
    
    if (!wallet || !itemId) {
      return res.status(400).json({ error: 'Wallet and itemId required' });
    }

    const result = await saveProgress(wallet, itemId, { page: currentPage, totalPages });
    res.json(result);
  } catch (err: any) {
    logger.error(`Ebook progress save failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/library/progress/ebook/:itemId', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId } = req.params;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const result = await getProgress(wallet, itemId);
    res.json(result || { progress: 0 });
  } catch (err: any) {
    logger.error(`Ebook progress fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/library/:itemId', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId } = req.params;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    logger.info(`Library item removal requested: ${itemId} by ${wallet}`);
    res.json({ ok: true, message: 'Item removed from library' });
  } catch (err: any) {
    logger.error(`Library item removal failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// COMMERCE ENDPOINTS
// =============================================================================

router.post('/commerce/purchase', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId, kind, priceWei, isRental } = req.body;
    
    if (!wallet || !itemId || !kind) {
      return res.status(400).json({ error: 'Wallet, itemId, and kind required' });
    }

    const result = await purchaseItem({
      wallet,
      itemId,
      kind,
      priceWei: priceWei || '0',
      isRental,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Purchase failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/commerce/rent', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId } = req.body;
    
    if (!wallet || !itemId) {
      return res.status(400).json({ error: 'Wallet and itemId required' });
    }

    const result = await rentMedia(wallet, itemId);
    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Rental failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/commerce/access/:itemId', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId } = req.params;
    const { kind } = req.query;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const result = await checkItemAccess(wallet, itemId, (kind || 'video') as ExperienceKind);
    res.json(result);
  } catch (err: any) {
    logger.error(`Access check failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/commerce/anchor', async (req: Request, res: Response) => {
  try {
    const { eventId, chain } = req.body;
    
    if (!eventId) {
      return res.status(400).json({ error: 'eventId required' });
    }

    const result = await anchorEventDirect(eventId, chain || 'base');

    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Anchor failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/commerce/anchor/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const result = await getEventAnchorStatus(eventId);
    res.json(result);
  } catch (err: any) {
    logger.error(`Anchor status failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// REVIEWS ENDPOINTS
// =============================================================================

router.get('/reviews/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { limit, offset } = req.query;
    
    const reviews = await getReviewsForItem(itemId, {
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    
    res.json(reviews);
  } catch (err: any) {
    logger.error(`Reviews fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/reviews/:itemId/stats', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const stats = await getItemStats(itemId);
    res.json(stats);
  } catch (err: any) {
    logger.error(`Review stats failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reviews', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId, rating, title, content } = req.body;
    
    if (!wallet || !itemId || !rating || !content) {
      return res.status(400).json({ error: 'Wallet, itemId, rating, and content required' });
    }

    const review = await createReview(wallet, itemId, {
      rating,
      title,
      content,
    });

    res.status(201).json(review);
  } catch (err: any) {
    logger.error(`Review create failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// VIEWPORT / LENS ENDPOINTS
// =============================================================================

router.post('/viewport/batch', async (req: Request, res: Response) => {
  try {
    const { sessionId, itemIds, lensType, clientVersions } = req.body;
    
    if (!sessionId || !itemIds || !Array.isArray(itemIds) || !lensType) {
      return res.status(400).json({ error: 'sessionId, itemIds[], and lensType required' });
    }

    if (!['card', 'quickview', 'playback'].includes(lensType)) {
      return res.status(400).json({ error: 'lensType must be card, quickview, or playback' });
    }

    const request: ViewportBatchRequest = {
      sessionId,
      itemIds,
      lensType: lensType as LensType,
      clientVersions,
    };

    const result = await getViewportBatch(request);
    res.json(result);
  } catch (err: any) {
    logger.error(`Viewport batch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/viewport/lens/:itemId/:lensType', async (req: Request, res: Response) => {
  try {
    const { itemId, lensType } = req.params;
    
    if (!['card', 'quickview', 'playback'].includes(lensType)) {
      return res.status(400).json({ error: 'lensType must be card, quickview, or playback' });
    }

    const lens = await generateLens(itemId, lensType as LensType);
    
    if (!lens) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const version = await getLensVersion(itemId, lensType as LensType);
    
    res.json({
      itemId,
      lensType,
      lens,
      version: version?.version || 1,
    });
  } catch (err: any) {
    logger.error(`Lens fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/viewport/delta/:itemId/:lensType', async (req: Request, res: Response) => {
  try {
    const { itemId, lensType } = req.params;
    const { sinceVersion } = req.query;
    
    if (!['card', 'quickview', 'playback'].includes(lensType)) {
      return res.status(400).json({ error: 'lensType must be card, quickview, or playback' });
    }

    if (!sinceVersion) {
      return res.status(400).json({ error: 'sinceVersion query param required' });
    }

    const delta = await getDelta(
      itemId, 
      lensType as LensType, 
      parseInt(sinceVersion as string)
    );
    
    if (!delta) {
      return res.json({ itemId, lensType, hasChanges: false });
    }

    res.json({
      itemId,
      lensType,
      hasChanges: true,
      delta,
    });
  } catch (err: any) {
    logger.error(`Delta fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/viewport/refresh/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    await refreshLensForItem(itemId);
    
    res.json({ success: true, itemId, message: 'All lenses refreshed' });
  } catch (err: any) {
    logger.error(`Lens refresh failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/viewport/history/:itemId/:lensType', async (req: Request, res: Response) => {
  try {
    const { itemId, lensType } = req.params;
    const { limit } = req.query;
    
    if (!['card', 'quickview', 'playback'].includes(lensType)) {
      return res.status(400).json({ error: 'lensType must be card, quickview, or playback' });
    }

    const history = await getDeltaHistory(
      itemId, 
      lensType as LensType,
      limit ? parseInt(limit as string) : 10
    );
    
    res.json({
      itemId,
      lensType,
      history,
      count: history.length,
    });
  } catch (err: any) {
    logger.error(`Delta history failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/viewport/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getLensStats();
    res.json(stats);
  } catch (err: any) {
    logger.error(`Lens stats failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/viewport/prune', async (req: Request, res: Response) => {
  try {
    const { days } = req.body;
    const result = await pruneOldVersions(days || 30);
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error(`Lens prune failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// SESSION ENDPOINTS
// =============================================================================

router.get('/sessions/stats', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const stats = await getSessionStats(wallet);
    res.json(stats);
  } catch (err: any) {
    logger.error(`Session stats failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/activity', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const { limit } = req.query;
    const activity = await getRecentActivity(wallet, limit ? parseInt(limit as string) : 20);
    res.json({ activity, count: activity.length });
  } catch (err: any) {
    logger.error(`Recent activity failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// INTENT ENDPOINTS
// =============================================================================

router.post('/intent/parse', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;
    
    if (!input) {
      return res.status(400).json({ error: 'Input text required' });
    }

    const command = parseAtlasOneCommand(input);
    
    if (!command) {
      return res.json({ matched: false, input });
    }

    res.json({
      matched: true,
      command,
      nlIntent: getAtlasOneNLIntent(command),
      feature: getAtlasOneFeature(command),
    });
  } catch (err: any) {
    logger.error(`Intent parse failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/intent/check', async (req: Request, res: Response) => {
  try {
    const { input } = req.query;
    
    if (!input) {
      return res.status(400).json({ error: 'Input text required' });
    }

    const isMatch = isAtlasOneCommand(input as string);
    res.json({ isAtlasOneCommand: isMatch, input });
  } catch (err: any) {
    logger.error(`Intent check failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// VERSION INFO
// =============================================================================

router.get('/version', (_req: Request, res: Response) => {
  res.json({
    name: 'Atlas One',
    version: '1.0.0',
    substrate: 'unified',
    kinds: ['game', 'video', 'ebook', 'app', 'product', 'audio'],
    features: [
      'catalog',
      'library',
      'commerce',
      'sessions',
      'intent',
      'reviews',
      'anchoring',
      'dual-mode-shopping',
      'sync',
    ],
  });
});

// =============================================================================
// SYNC ENDPOINTS
// =============================================================================

import {
  runFullSync,
  syncGames,
  syncVideos,
  syncLiveTV,
  syncEbooks,
  syncProducts,
  getCatalogCounts,
} from '../atlas/one/sync/index';

router.post('/sync/full', async (_req: Request, res: Response) => {
  try {
    logger.info('Starting full content sync...');
    const result = await runFullSync();
    res.json(result);
  } catch (err: any) {
    logger.error(`Full sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/games', async (_req: Request, res: Response) => {
  try {
    const results = await syncGames();
    res.json({ results, total: results.reduce((sum, r) => sum + r.imported, 0) });
  } catch (err: any) {
    logger.error(`Game sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/videos', async (_req: Request, res: Response) => {
  try {
    const results = await syncVideos();
    res.json({ results, total: results.reduce((sum, r) => sum + r.imported, 0) });
  } catch (err: any) {
    logger.error(`Video sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/livetv', async (_req: Request, res: Response) => {
  try {
    logger.info('Starting Live TV channel sync...');
    const results = await syncLiveTV();
    const total = results.reduce((sum, r) => sum + r.imported, 0);
    logger.info(`Live TV sync complete: ${total} channels imported`);
    res.json({ results, total });
  } catch (err: any) {
    logger.error(`Live TV sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/ebooks', async (_req: Request, res: Response) => {
  try {
    const results = await syncEbooks();
    res.json({ results, total: results.reduce((sum, r) => sum + r.imported, 0) });
  } catch (err: any) {
    logger.error(`Ebook sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

import { syncInternetArchiveFilms } from '../atlas/one/sync/internetArchiveService';
import { syncTVMazeShows } from '../atlas/one/sync/tvmazeService';

router.post('/sync/internetarchive', async (_req: Request, res: Response) => {
  try {
    logger.info('Starting Internet Archive public domain films sync...');
    const result = await syncInternetArchiveFilms({ limit: 500 });
    logger.info(`Internet Archive sync complete: ${result.imported} films imported`);
    res.json(result);
  } catch (err: any) {
    logger.error(`Internet Archive sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/tvmaze', async (_req: Request, res: Response) => {
  try {
    logger.info('Starting TVMaze TV shows sync...');
    const result = await syncTVMazeShows({ pages: 20, minRating: 6 });
    logger.info(`TVMaze sync complete: ${result.imported} shows imported`);
    res.json(result);
  } catch (err: any) {
    logger.error(`TVMaze sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/products', async (_req: Request, res: Response) => {
  try {
    const results = await syncProducts();
    res.json({ results, total: results.reduce((sum, r) => sum + r.imported, 0) });
  } catch (err: any) {
    logger.error(`Product sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/tmdb', async (_req: Request, res: Response) => {
  try {
    const { syncAllTMDb } = await import('../atlas/one/sync/tmdbService');
    logger.info('Starting TMDb sync...');
    const results = await syncAllTMDb();
    const total = results.reduce((sum, r) => sum + r.imported, 0);
    logger.info(`TMDb sync complete: ${total} items imported`);
    res.json({ results, total });
  } catch (err: any) {
    logger.error(`TMDb sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/watchmode', async (_req: Request, res: Response) => {
  try {
    const { syncAllAVOD } = await import('../atlas/one/sync/watchmodeService');
    logger.info('Starting Watchmode AVOD sync...');
    const results = await syncAllAVOD();
    const total = results.reduce((sum, r) => sum + r.imported, 0);
    logger.info(`Watchmode sync complete: ${total} items imported`);
    res.json({ results, total });
  } catch (err: any) {
    logger.error(`Watchmode sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/counts', async (_req: Request, res: Response) => {
  try {
    const counts = await getCatalogCounts();
    res.json(counts);
  } catch (err: any) {
    logger.error(`Catalog counts failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// DUAL-MODE SHOPPING ENDPOINTS
// =============================================================================

import {
  ingestProduct,
  getDualModeCard,
  logBrowserPurchase,
  getBrowserPurchases,
  searchProducts,
  batchIngestProducts,
  type ProductManifest,
  type PurchaseMode,
} from '../atlas/one/products/index';
import { autoAdaptProduct } from '../atlas/one/products/adapters';

const ProductManifestSchema = z.object({
  id: z.string().optional(),
  externalId: z.string().optional(),
  source: z.string(),
  title: z.string(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  images: z.array(z.string()).optional(),
  priceWei: z.string().optional(),
  priceFiat: z.object({
    amount: z.number(),
    currency: z.string(),
  }).optional(),
  merchantUrl: z.string(),
  merchantName: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  inStock: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const BrowserPurchaseSchema = z.object({
  productId: z.string(),
  merchantUrl: z.string(),
  priceFiat: z.object({
    amount: z.number(),
    currency: z.string(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.get('/products', async (req: Request, res: Response) => {
  try {
    const { search, category, source, inStock, limit, offset } = req.query;
    
    const result = await searchProducts({
      search: search as string | undefined,
      category: category as string | undefined,
      source: source as string | undefined,
      inStock: inStock === 'true',
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json(result);
  } catch (err: any) {
    logger.error(`Product search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/products/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const card = await getDualModeCard(productId);
    
    if (!card) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(card);
  } catch (err: any) {
    logger.error(`Product fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/products/:productId/card', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const card = await getDualModeCard(productId);
    
    if (!card) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      ...card,
      displayMode: 'dual',
      ctaOptions: [
        { mode: 'anchored', label: 'Buy with Atlas', description: 'Wallet receipt + ownership' },
        { mode: 'browser', label: 'Merchant Checkout', description: 'Open store in browser' },
      ],
    });
  } catch (err: any) {
    logger.error(`Product card fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/ingest', async (req: Request, res: Response) => {
  try {
    const parsed = ProductManifestSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid product manifest', details: parsed.error.issues });
    }

    const manifest = parsed.data as ProductManifest;
    manifest.id = manifest.id || `${manifest.source}-${Date.now()}`;
    
    const result = await ingestProduct(manifest);
    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Product ingest failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/ingest/batch', async (req: Request, res: Response) => {
  try {
    const { products, source } = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Products array required' });
    }

    const manifests: ProductManifest[] = products
      .map((p: any) => autoAdaptProduct(p, source))
      .filter(Boolean) as ProductManifest[];

    const result = await batchIngestProducts(manifests);
    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Batch ingest failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/purchase/browser', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const parsed = BrowserPurchaseSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid purchase data', details: parsed.error.issues });
    }

    const result = await logBrowserPurchase({
      wallet,
      productId: parsed.data.productId,
      merchantUrl: parsed.data.merchantUrl,
      timestamp: new Date(),
      priceFiat: parsed.data.priceFiat,
      metadata: parsed.data.metadata,
    });

    res.status(201).json({
      ...result,
      mode: 'browser',
      message: 'Browser purchase logged. Receipt pending anchoring.',
    });
  } catch (err: any) {
    logger.error(`Browser purchase log failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/products/purchases/browser', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const { limit } = req.query;
    const purchases = await getBrowserPurchases(wallet, limit ? parseInt(limit as string) : 50);
    res.json({ purchases, count: purchases.length });
  } catch (err: any) {
    logger.error(`Browser purchases fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/purchase/anchored', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { productId, priceWei } = req.body;
    
    if (!wallet || !productId) {
      return res.status(400).json({ error: 'Wallet and productId required' });
    }

    const result = await purchaseItem({
      wallet,
      itemId: productId,
      kind: 'product',
      priceWei: priceWei || '0',
      isRental: false,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json({
      ...result,
      mode: 'anchored',
      message: 'Purchase completed with wallet receipt.',
    });
  } catch (err: any) {
    logger.error(`Anchored purchase failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// ADMIN: SYNC & BACKFILL ENDPOINTS (Internal use only)
// =============================================================================

router.post('/admin/sync/iptv', async (req: Request, res: Response) => {
  try {
    const { countries, categories, limit = 5000 } = req.body;
    
    const { syncIPTVChannels } = await import('../atlas/one/sync/iptvService');
    const result = await syncIPTVChannels({
      countries: countries || [],
      categories: categories || [],
      limit: Math.min(limit, 40000),
      excludeNSFW: true,
    });
    
    logger.info(`IPTV sync complete: ${result.imported} channels imported`);
    res.json(result);
  } catch (err: any) {
    logger.error(`IPTV sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/backfill/ebooks', async (req: Request, res: Response) => {
  try {
    const { backfillEbookDownloadUrls } = await import('../atlas/gamedeck/ebookService');
    const result = await backfillEbookDownloadUrls();
    
    logger.info(`Ebook backfill complete: ${result.updated} updated`);
    res.json(result);
  } catch (err: any) {
    logger.error(`Ebook backfill failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/sync/full', async (req: Request, res: Response) => {
  try {
    const { syncFullCatalog } = await import('../atlas/one/sync/index');
    const result = await syncFullCatalog();
    
    logger.info(`Full catalog sync complete`);
    res.json(result);
  } catch (err: any) {
    logger.error(`Full sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/catalog/stats', async (_req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { marketplaceItems, games } = await import('@shared/schema');
    const { sql, eq } = await import('drizzle-orm');
    
    const [gamesCount] = await db.select({ count: sql<number>`count(*)` }).from(games);
    const [videosCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItems).where(eq(marketplaceItems.itemType, 'video'));
    const [ebooksCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItems).where(eq(marketplaceItems.itemType, 'ebook'));
    const [productsCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItems).where(eq(marketplaceItems.itemType, 'product'));
    const [liveTvCount] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItems).where(sql`category = 'live-tv'`);
    const [ebooksWithDownload] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItems).where(sql`item_type = 'ebook' AND metadata->>'downloadUrl' IS NOT NULL`);
    
    res.json({
      games: Number(gamesCount.count),
      videos: Number(videosCount.count),
      ebooks: Number(ebooksCount.count),
      ebooksWithDownloadUrl: Number(ebooksWithDownload.count),
      products: Number(productsCount.count),
      liveTV: Number(liveTvCount.count),
      total: Number(gamesCount.count) + Number(videosCount.count) + Number(ebooksCount.count) + Number(productsCount.count),
    });
  } catch (err: any) {
    logger.error(`Catalog stats failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/scheduler/status', async (_req: Request, res: Response) => {
  try {
    const { getSchedulerStatus } = await import('../atlas/one/sync/scheduler');
    const status = await getSchedulerStatus();
    res.json(status);
  } catch (err: any) {
    logger.error(`Scheduler status failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/scheduler/toggle/:source', async (req: Request, res: Response) => {
  try {
    const { source } = req.params;
    const { enabled } = req.body;
    
    const { toggleSource } = await import('../atlas/one/sync/scheduler');
    await toggleSource(source, enabled);
    
    res.json({ source, enabled, message: `Sync ${enabled ? 'enabled' : 'disabled'} for ${source}` });
  } catch (err: any) {
    logger.error(`Toggle source failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/scheduler/trigger/:source', async (req: Request, res: Response) => {
  try {
    const { source } = req.params;
    
    const { triggerSync } = await import('../atlas/one/sync/scheduler');
    const result = await triggerSync(source);
    
    res.json({ source, ...result });
  } catch (err: any) {
    logger.error(`Trigger sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/products/sync', async (req: Request, res: Response) => {
  try {
    const { source } = req.body;
    const { syncOpenFoodFacts, syncGitHubReleases, syncItchioProducts } = await import('../atlas/one/sync/scheduler');
    
    let result;
    if (source === 'openfoodfacts') {
      result = await syncOpenFoodFacts({ pageSize: 50 });
    } else if (source === 'github') {
      result = await syncGitHubReleases({ limit: 20 });
    } else if (source === 'itchio') {
      result = await syncItchioProducts({});
    } else {
      const off = await syncOpenFoodFacts({ pageSize: 30 });
      const gh = await syncGitHubReleases({ limit: 15 });
      const itch = await syncItchioProducts({});
      result = {
        openFoodFacts: off,
        github: gh,
        itchio: itch,
        total: off.imported + gh.imported + itch.imported,
      };
    }
    
    res.json(result);
  } catch (err: any) {
    logger.error(`Product sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/products/demo', async (_req: Request, res: Response) => {
  try {
    const { removeDemoProducts } = await import('../atlas/one/sync/scheduler');
    const removed = await removeDemoProducts();
    res.json({ removed, message: `Removed ${removed} demo products` });
  } catch (err: any) {
    logger.error(`Remove demo products failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// ACCESS MANIFEST ENDPOINTS - Playable/Readable/Launchable Content
// =============================================================================

router.get('/access/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    const item = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, itemId)).limit(1);
    
    if (!item[0]) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const { resolveAccess } = await import('../atlas/core/access/index');
    
    const accessResult = resolveAccess({
      itemType: item[0].itemType,
      source: item[0].source || 'developer',
      providerId: item[0].providerId || undefined,
      url: (item[0].metadata as any)?.url || (item[0].manifest as any)?.apiEndpoint,
      metadata: item[0].metadata as Record<string, any>,
    });
    
    if (!accessResult.access) {
      return res.status(404).json({ 
        error: accessResult.error || 'No access available for this item',
        itemType: item[0].itemType,
      });
    }
    
    res.json({
      itemId,
      itemType: item[0].itemType,
      title: item[0].title,
      access: accessResult.access,
    });
  } catch (err: any) {
    logger.error(`Access resolution failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/access/:itemId/manifest', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    const item = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, itemId)).limit(1);
    
    if (!item[0]) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    if (item[0].access) {
      return res.json({
        id: itemId,
        type: item[0].itemType,
        title: item[0].title,
        source: item[0].source,
        providerId: item[0].providerId,
        access: item[0].access,
      });
    }
    
    const { resolveAccess } = await import('../atlas/core/access/index');
    
    const accessResult = resolveAccess({
      itemType: item[0].itemType,
      source: item[0].source || 'developer',
      providerId: item[0].providerId || undefined,
      url: (item[0].metadata as any)?.url || (item[0].manifest as any)?.apiEndpoint,
      metadata: item[0].metadata as Record<string, any>,
    });
    
    res.json({
      id: itemId,
      type: item[0].itemType,
      title: item[0].title,
      source: item[0].source,
      providerId: item[0].providerId,
      access: accessResult.access,
      resolved: !item[0].access,
    });
  } catch (err: any) {
    logger.error(`Access manifest failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/access/receipt', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { itemId, itemType, source, providerId, action, accessMode, accessFormat, accessUri, durationMs, metadata } = req.body;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    if (!action || !itemType) {
      return res.status(400).json({ error: 'Action and itemType are required' });
    }
    
    const { accessReceipts } = await import('@shared/schema');
    
    const [receipt] = await db.insert(accessReceipts).values({
      wallet,
      itemId: itemId || null,
      itemType,
      source: source || null,
      providerId: providerId || null,
      action,
      accessMode: accessMode || null,
      accessFormat: accessFormat || null,
      accessUri: accessUri || null,
      durationMs: durationMs || null,
      metadata: metadata || null,
    }).returning();
    
    logger.info(`Access receipt logged: ${wallet} ${action} ${itemType} ${providerId || itemId}`);
    
    res.status(201).json({
      ok: true,
      receiptId: receipt.id,
      action,
      itemType,
    });
  } catch (err: any) {
    logger.error(`Access receipt failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/access/receipts', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const { limit, offset, action, itemType } = req.query;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    const { accessReceipts } = await import('@shared/schema');
    
    let query = db.select().from(accessReceipts).where(eq(accessReceipts.wallet, wallet));
    
    if (action) {
      query = query.where(eq(accessReceipts.action, action as any));
    }
    
    if (itemType) {
      query = query.where(eq(accessReceipts.itemType, itemType as any));
    }
    
    const receipts = await query
      .orderBy(sql`created_at DESC`)
      .limit(limit ? parseInt(limit as string) : 50)
      .offset(offset ? parseInt(offset as string) : 0);
    
    res.json({ receipts, count: receipts.length });
  } catch (err: any) {
    logger.error(`Access receipts fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/access/backfill/status', async (_req: Request, res: Response) => {
  try {
    const { getBackfillStatus } = await import('../atlas/one/sync/accessBackfill');
    const status = await getBackfillStatus();
    res.json(status);
  } catch (err: any) {
    logger.error(`Backfill status failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/access/backfill', async (req: Request, res: Response) => {
  try {
    const { batchSize, itemType, forceUpdate, limit } = req.body;
    
    const { backfillAccessManifests } = await import('../atlas/one/sync/accessBackfill');
    const result = await backfillAccessManifests({
      batchSize: batchSize || 100,
      itemType,
      forceUpdate: forceUpdate || false,
      limit,
    });
    
    res.json(result);
  } catch (err: any) {
    logger.error(`Backfill failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
