/**
 * Atlas One Content - Unified content access and playback
 * 
 * Manages access to all content types:
 * - Games: Launch manifests and saves
 * - Media: Streaming with playback position
 * - Ebooks: Reading progress and highlights
 * - Apps: Manifest execution
 * - Products: Order fulfillment
 */

export {
  checkAccess,
  getLibrary,
  rentMedia,
  purchaseMedia,
  savePlaybackPosition,
} from '../../gamedeck/mediaService';

export {
  getProgress,
  saveProgress,
  addHighlight,
  addNote,
  addBookmark,
  checkEbookAccess,
  getEbookLibrary,
  getContinueReading,
} from '../../gamedeck/ebookService';

export {
  getWalletFavorites,
  favoriteGame,
  unfavoriteGame,
} from '../../gamedeck/gamesService';

import { db } from '../../../db';
import { marketplaceItems, mediaAccess, readingProgress } from '@shared/schema';
import { eq, and, or, desc, gt, isNull } from 'drizzle-orm';
import type { ExperienceKind, AtlasOneContinueItem, AtlasOneLibraryResult } from '../types';

/**
 * Get unified "Continue" items across all content types
 * Shows recently accessed games, media with playback position, books with reading progress
 */
export async function getContinueItems(
  wallet: string,
  limit: number = 10
): Promise<AtlasOneContinueItem[]> {
  const continueItems: AtlasOneContinueItem[] = [];

  const [mediaItems, bookItems] = await Promise.all([
    db.select()
      .from(mediaAccess)
      .where(and(
        eq(mediaAccess.wallet, wallet),
        or(
          isNull(mediaAccess.expiresAt),
          gt(mediaAccess.expiresAt, new Date())
        )
      ))
      .orderBy(desc(mediaAccess.updatedAt))
      .limit(limit),
    
    db.select()
      .from(readingProgress)
      .where(eq(readingProgress.wallet, wallet))
      .orderBy(desc(readingProgress.lastReadAt))
      .limit(limit),
  ]);

  for (const media of mediaItems) {
    if (media.playbackPosition && media.playbackPosition > 0) {
      const [item] = await db.select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.id, media.itemId))
        .limit(1);
      
      if (item) {
        continueItems.push({
          access: {
            id: media.id,
            wallet: media.wallet,
            itemId: media.itemId,
            kind: 'video',
            accessType: media.accessType as any,
            priceWei: media.priceWei || undefined,
            expiresAt: media.expiresAt || undefined,
            progress: media.playbackPosition,
            metadata: media.metadata as Record<string, unknown> | undefined,
            createdAt: media.createdAt,
          },
          item: {
            id: item.id,
            kind: item.itemType as ExperienceKind,
            title: item.title,
            slug: item.slug,
            description: item.description || undefined,
            thumbnail: item.thumbnail || undefined,
            coverImage: item.coverImage || undefined,
            category: item.category,
            subcategory: item.subcategory || undefined,
            tags: item.tags || [],
            priceWei: item.priceWei || undefined,
            currency: item.currency || 'ETH',
            status: item.status as any,
            featured: item.featured || false,
            rating: item.rating ? parseFloat(item.rating) : undefined,
            downloads: item.downloads || 0,
            purchases: item.purchases || 0,
            creatorWallet: item.creatorWallet,
            metadata: item.metadata as Record<string, unknown> | undefined,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            publishedAt: item.publishedAt || undefined,
          },
          lastActivity: media.updatedAt,
        });
      }
    }
  }

  for (const book of bookItems) {
    const percentComplete = book.percentComplete ? parseFloat(book.percentComplete) : 0;
    if (percentComplete > 0 && percentComplete < 100) {
      const [item] = await db.select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.id, book.itemId))
        .limit(1);
      
      if (item) {
        continueItems.push({
          access: {
            id: book.id,
            wallet: book.wallet,
            itemId: book.itemId,
            kind: 'ebook',
            accessType: 'purchase',
            progress: percentComplete,
            metadata: { currentPage: book.currentPage, totalPages: book.totalPages },
            createdAt: book.createdAt,
          },
          item: {
            id: item.id,
            kind: item.itemType as ExperienceKind,
            title: item.title,
            slug: item.slug,
            description: item.description || undefined,
            thumbnail: item.thumbnail || undefined,
            coverImage: item.coverImage || undefined,
            category: item.category,
            subcategory: item.subcategory || undefined,
            tags: item.tags || [],
            priceWei: item.priceWei || undefined,
            currency: item.currency || 'ETH',
            status: item.status as any,
            featured: item.featured || false,
            rating: item.rating ? parseFloat(item.rating) : undefined,
            downloads: item.downloads || 0,
            purchases: item.purchases || 0,
            creatorWallet: item.creatorWallet,
            metadata: item.metadata as Record<string, unknown> | undefined,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            publishedAt: item.publishedAt || undefined,
          },
          lastActivity: book.lastReadAt,
        });
      }
    }
  }

  continueItems.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  return continueItems.slice(0, limit);
}

/**
 * Get unified library for wallet across all content types
 */
export async function getUnifiedLibrary(
  wallet: string,
  kind?: ExperienceKind
): Promise<AtlasOneLibraryResult> {
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

  const items = accessItems.map(access => ({
    id: access.id,
    wallet: access.wallet,
    itemId: access.itemId,
    kind: 'video' as ExperienceKind,
    accessType: access.accessType as any,
    priceWei: access.priceWei || undefined,
    expiresAt: access.expiresAt || undefined,
    progress: access.playbackPosition || undefined,
    metadata: access.metadata as Record<string, unknown> | undefined,
    createdAt: access.createdAt,
  }));

  return {
    items: kind ? items.filter(i => i.kind === kind) : items,
    count: items.length,
    wallet,
  };
}
