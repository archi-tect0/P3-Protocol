import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { mediaAccess, marketplaceItems } from '@shared/schema';
import { eq, and, or, isNull, gt, desc } from 'drizzle-orm';
import { getContinueItems } from '../one/content';

type LibraryKind = 'video' | 'game' | 'ebook' | 'product' | 'audio' | 'app';
const VALID_LIBRARY_KINDS: LibraryKind[] = ['video', 'game', 'ebook', 'product', 'audio', 'app'];

const router = Router();

function isValidWallet(wallet: string): boolean {
  return typeof wallet === 'string' && 
    wallet.length >= 10 && 
    /^0x[a-fA-F0-9]{40}$/.test(wallet);
}

interface HydratedLibraryItem {
  id: string;
  itemId: string;
  kind: 'video' | 'game' | 'ebook' | 'product' | 'audio' | 'app';
  title: string;
  slug?: string;
  description?: string;
  thumbnail?: string;
  coverImage?: string;
  progress?: number;
  accessType: string;
  expiresAt?: string;
  addedAt: string;
  priceWei?: string;
  category?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

function normalizeKind(rawType: string | null): HydratedLibraryItem['kind'] {
  if (!rawType) return 'video';
  const lower = rawType.toLowerCase().split(':')[0].split('.')[0];
  if (lower === 'video' || lower === 'tv' || lower === 'movie') return 'video';
  if (lower === 'game' || lower === 'gaming') return 'game';
  if (lower === 'ebook' || lower === 'book' || lower === 'epub') return 'ebook';
  if (lower === 'product' || lower === 'item' || lower === 'physical') return 'product';
  if (lower === 'audio' || lower === 'music' || lower === 'podcast') return 'audio';
  if (lower === 'app' || lower === 'application') return 'app';
  return 'video';
}

function parseMetadata(meta: unknown): Record<string, unknown> | null {
  if (!meta) return null;
  if (typeof meta === 'object') return meta as Record<string, unknown>;
  if (typeof meta === 'string') {
    try { return JSON.parse(meta); } catch { return null; }
  }
  return null;
}

async function getHydratedLibrary(wallet: string, kind?: string): Promise<HydratedLibraryItem[]> {
  const accessItems = await db.select()
    .from(mediaAccess)
    .where(and(
      eq(mediaAccess.wallet, wallet),
      or(
        isNull(mediaAccess.expiresAt),
        gt(mediaAccess.expiresAt, new Date())
      )
    ))
    .orderBy(desc(mediaAccess.createdAt));

  const hydratedItems: HydratedLibraryItem[] = [];

  for (const access of accessItems) {
    const accessMeta = parseMetadata(access.metadata);
    if (accessMeta?.hidden === true) continue;

    const [item] = await db.select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, access.itemId))
      .limit(1);

    if (item) {
      const normalizedKind = normalizeKind(item.itemType);
      if (kind && normalizedKind !== kind) continue;

      const itemMeta = parseMetadata(item.metadata);
      const accessMeta = parseMetadata(access.metadata);
      
      const catalogSourceUrl = (itemMeta?.streamUrl || itemMeta?.url || itemMeta?.sourceUrl) as string | undefined;
      const accessSourceUrl = (accessMeta?.streamUrl || accessMeta?.url || accessMeta?.sourceUrl) as string | undefined;
      const resolvedSourceUrl = catalogSourceUrl || accessSourceUrl || `/api/atlas/one/stream/${access.itemId}`;

      hydratedItems.push({
        id: access.id,
        itemId: access.itemId,
        kind: normalizedKind,
        title: item.title,
        slug: item.slug || `item-${access.itemId}`,
        description: item.description || `Access to ${item.title}`,
        thumbnail: item.thumbnail || item.coverImage || undefined,
        coverImage: item.coverImage || undefined,
        progress: access.playbackPosition || undefined,
        accessType: access.accessType,
        expiresAt: access.expiresAt?.toISOString(),
        addedAt: access.createdAt.toISOString(),
        priceWei: item.priceWei || undefined,
        category: item.category || normalizedKind,
        sourceUrl: resolvedSourceUrl,
        metadata: { ...(itemMeta ?? {}), ...(accessMeta ?? {}) },
      });
    }
  }

  return hydratedItems;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    const kind = req.query.kind as LibraryKind | undefined;

    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'wallet query parameter is required',
        'data-testid': 'library-error',
      });
      return;
    }

    if (!isValidWallet(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'library-error',
      });
      return;
    }

    if (kind && !VALID_LIBRARY_KINDS.includes(kind)) {
      res.status(400).json({
        ok: false,
        error: `Invalid kind. Valid values: ${VALID_LIBRARY_KINDS.join(', ')}`,
        'data-testid': 'library-error',
      });
      return;
    }

    const items = await getHydratedLibrary(wallet.toLowerCase(), kind);

    res.json({
      ok: true,
      items,
      count: items.length,
      wallet: wallet.toLowerCase(),
      'data-testid': 'library-response',
    });
  } catch (error) {
    console.error('Library fetch error:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch library',
      'data-testid': 'library-error',
    });
  }
});

router.get('/continue', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    const limitParam = req.query.limit as string | undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'wallet query parameter is required',
        'data-testid': 'library-continue-error',
      });
      return;
    }

    if (!isValidWallet(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'library-continue-error',
      });
      return;
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({
        ok: false,
        error: 'limit must be a number between 1 and 100',
        'data-testid': 'library-continue-error',
      });
      return;
    }

    const items = await getContinueItems(wallet.toLowerCase(), limit);

    res.json({
      ok: true,
      items,
      count: items.length,
      'data-testid': 'library-continue-response',
    });
  } catch (error) {
    console.error('Continue items fetch error:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch continue items',
      'data-testid': 'library-continue-error',
    });
  }
});

router.delete('/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { wallet } = req.body as { wallet?: string };

    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'wallet is required in request body',
        'data-testid': 'library-delete-error',
      });
      return;
    }

    if (!isValidWallet(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'library-delete-error',
      });
      return;
    }

    if (!itemId) {
      res.status(400).json({
        ok: false,
        error: 'itemId is required',
        'data-testid': 'library-delete-error',
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(mediaAccess)
      .where(and(
        eq(mediaAccess.id, itemId),
        eq(mediaAccess.wallet, wallet.toLowerCase())
      ))
      .limit(1);

    if (!existing) {
      res.status(404).json({
        ok: false,
        error: 'Library item not found or does not belong to wallet',
        'data-testid': 'library-delete-error',
      });
      return;
    }

    const existingMetadata = parseMetadata(existing.metadata) || {};
    const updatedMetadata = { ...existingMetadata, hidden: true, hiddenAt: new Date().toISOString() };
    
    await db
      .update(mediaAccess)
      .set({
        metadata: updatedMetadata
      })
      .where(and(
        eq(mediaAccess.id, itemId),
        eq(mediaAccess.wallet, wallet.toLowerCase())
      ));

    res.json({
      ok: true,
      message: 'Item hidden from library',
      'data-testid': 'library-delete-response',
    });
  } catch (error) {
    console.error('Library item hide error:', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to hide item from library',
      'data-testid': 'library-delete-error',
    });
  }
});

export default router;
