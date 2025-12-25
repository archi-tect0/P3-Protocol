/**
 * Atlas One Catalog - Unified marketplace catalog
 * 
 * Re-exports and extends catalogService for Atlas One substrate.
 */

export {
  searchItems,
  getItem,
  getItemBySlug,
  createItem,
  updateItem,
  publishItem,
  getItemsByType,
  getFeaturedItems as getCatalogFeatured,
  getCategories,
  getCategoryItems,
  getStoreItems,
  getCatalogStats,
  type SearchFilters,
  type SearchResult,
  type CreateItemData,
  type ItemType,
} from '../../gamedeck/catalogService';

export {
  pullFreeToGame,
  pullGamerPower,
  searchGames,
  getGame,
  getGamesBySource,
  favoriteGame,
  unfavoriteGame,
  getWalletFavorites,
} from '../../gamedeck/gamesService';

export {
  searchOMDB,
  importFromOMDB,
  batchImportFromOMDB,
} from '../../gamedeck/mediaService';

export {
  importFromGoogleBooks,
  importFromOpenLibrary,
  importFromGutendex,
  getEbookCatalog,
} from '../../gamedeck/ebookService';

export {
  generateLens,
  generateCardLens,
  generateQuickviewLens,
  generatePlaybackLens,
  getDelta,
  getLensVersion,
  storeLensVersion,
  getViewportBatch,
  refreshLensForItem,
  incrementLensVersion,
} from './lensService';

export {
  storeLens,
  getLens,
  getVersion,
  getDeltaSince,
  getDeltaHistory,
  pruneOldVersions,
  invalidateLens,
  getLensStats,
  computeChecksum,
} from './lensStore';

import { searchItems, type SearchFilters, type SearchResult } from '../../gamedeck/catalogService';
import { searchGames as searchGamesDB } from '../../gamedeck/gamesService';
import type { AtlasOneSearchFilters, AtlasOneSearchResult, ExperienceKind, AtlasOneItem } from '../types';
export type { ExperienceKind } from '../types';

/**
 * Unified Atlas One catalog search
 * Merges items from marketplace_items + games tables
 */
export async function searchAtlasOne(
  filters: AtlasOneSearchFilters
): Promise<AtlasOneSearchResult> {
  const items: AtlasOneItem[] = [];
  let totalCount = 0;

  // If searching for games or all items, include games from games table
  if (!filters.kind || filters.kind === 'game') {
    const gameFilters = {
      search: filters.search,
      genre: filters.category,
      limit: filters.kind === 'game' ? (filters.limit || 50) : Math.min(filters.limit || 50, 20),
      offset: filters.kind === 'game' ? (filters.offset || 0) : 0,
    };
    
    const gamesArray = await searchGamesDB(gameFilters);
    
    const gameItems: AtlasOneItem[] = gamesArray.map(game => ({
      id: game.id,
      kind: 'game' as ExperienceKind,
      title: game.title,
      slug: game.id.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
      description: game.description || undefined,
      thumbnail: game.thumbnail || undefined,
      coverImage: game.thumbnail || undefined,
      category: game.genre || 'game',
      subcategory: game.platform || undefined,
      tags: game.tags || [],
      priceWei: '0',
      currency: 'ETH',
      status: 'published' as const,
      featured: false,
      rating: game.rating ? parseFloat(String(game.rating)) : undefined,
      downloads: 0,
      purchases: 0,
      creatorWallet: 'system',
      metadata: {
        source: game.source,
        developer: game.developer,
        platform: game.platform,
        url: game.url,
        ...(game.metadata as Record<string, unknown> || {}),
      },
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    }));
    
    items.push(...gameItems);
    totalCount += gamesArray.length;
  }

  // If not game-only, also search marketplace_items
  if (filters.kind !== 'game') {
    const catalogFilters: SearchFilters = {
      type: filters.kind as any,
      category: filters.category,
      tags: filters.tags,
      search: filters.search,
      status: filters.status,
      featured: filters.featured,
      creatorWallet: filters.creatorWallet,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    };

    const result = await searchItems(catalogFilters);
    
    const catalogItems: AtlasOneItem[] = result.items.map(item => ({
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
    }));
    
    items.push(...catalogItems);
    totalCount += result.count;
  }

  return {
    items,
    count: totalCount,
    filters,
  };
}

/**
 * Get featured items for Atlas One discovery
 */
export async function getFeaturedItems(limit: number = 12): Promise<AtlasOneSearchResult> {
  return searchAtlasOne({
    featured: true,
    status: 'published',
    limit,
  });
}

/**
 * Get items by kind for Atlas One
 */
export async function getItemsByKind(
  kind: ExperienceKind,
  limit: number = 50,
  offset: number = 0
): Promise<AtlasOneSearchResult> {
  return searchAtlasOne({
    kind,
    status: 'published',
    limit,
    offset,
  });
}
