/**
 * CatalogService - Unified marketplace catalog management
 * 
 * Manages marketplace_items (games, apps, ebooks, videos, audio, products) with:
 * - Type-specific item creation
 * - Unified search across all item types
 * - Media asset management for streaming
 * - Category operations from category_registry
 * - Merchant store operations
 * 
 * Extends patterns from gamesService.ts for consistency.
 */

import { db } from '../../db';
import {
  marketplaceItems,
  mediaAssets,
  merchantStores,
  categoryRegistry,
  marketplaceReceiptsTable,
  type MarketplaceItem,
  type InsertMarketplaceItem,
  type MediaAsset,
  type InsertMediaAsset,
  type MerchantStore,
  type InsertMerchantStore,
  type CategoryRegistry,
} from '@shared/schema';
import { eq, and, or, ilike, sql, desc, asc, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

// Item types
export type ItemType = 'game' | 'app' | 'ebook' | 'video' | 'audio' | 'product';

// Filter interfaces
export interface SearchFilters {
  type?: ItemType;
  category?: string;
  tags?: string[];
  search?: string;
  status?: 'draft' | 'published' | 'archived' | 'suspended';
  featured?: boolean;
  creatorWallet?: string;
  limit?: number;
  offset?: number;
}

export interface CreateItemData {
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  thumbnail?: string;
  coverImage?: string;
  priceWei?: string;
  currency?: string;
  manifest?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: 'draft' | 'published';
}

export interface MediaAssetData {
  assetType: string;
  url: string;
  mimeType?: string;
  duration?: number;
  pageCount?: number;
  fileSize?: number;
  resolution?: string;
  bitrate?: number;
  language?: string;
  subtitles?: string[];
  chapters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  items: MarketplaceItem[];
  count: number;
}

export interface CategoryResult {
  categories: CategoryRegistry[];
  count: number;
}

export interface StoreItemsResult {
  items: MarketplaceItem[];
  count: number;
  store: MerchantStore | null;
}

/**
 * Generate unique request ID for audit trail
 */
function generateRequestId(): string {
  return `catalog:${Date.now()}:${uuid().slice(0, 8)}`;
}

/**
 * Generate URL-safe slug from title
 */
function generateSlug(title: string, suffix?: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
  return suffix ? `${base}-${suffix}` : base;
}

// =============================================================================
// ITEM CREATION
// =============================================================================

/**
 * Create a new marketplace item
 * 
 * Creates an entry in marketplace_items with the specified type and data.
 * Generates receipt for audit trail.
 * 
 * @param wallet - Creator wallet address
 * @param itemType - Type of item (game, app, ebook, video, audio, product)
 * @param data - Item data
 * @returns Created item or null on error
 */
export async function createItem(
  wallet: string,
  itemType: ItemType,
  data: CreateItemData
): Promise<MarketplaceItem | null> {
  try {
    const slug = generateSlug(data.title, uuid().slice(0, 8));
    
    const insertData: InsertMarketplaceItem = {
      itemType,
      title: data.title,
      slug,
      description: data.description ?? null,
      creatorWallet: wallet,
      category: data.category,
      subcategory: data.subcategory ?? null,
      tags: data.tags ?? null,
      thumbnail: data.thumbnail ?? null,
      coverImage: data.coverImage ?? null,
      priceWei: data.priceWei ?? '0',
      currency: data.currency ?? 'ETH',
      manifest: data.manifest ?? null,
      metadata: data.metadata ?? null,
      status: data.status ?? 'draft',
      featured: false,
      rating: null,
      downloads: 0,
      purchases: 0,
      publishedAt: data.status === 'published' ? new Date() : null,
    };

    const [item] = await db
      .insert(marketplaceItems)
      .values(insertData)
      .returning();

    const requestId = generateRequestId();
    await db.insert(marketplaceReceiptsTable).values({
      wallet,
      kind: 'item.create',
      refId: item.id,
      refType: 'marketplace_item',
      metaJson: {
        itemType,
        title: data.title,
        category: data.category,
      },
      requestId,
    });

    return item;
  } catch (err) {
    console.error('Error creating marketplace item:', err);
    return null;
  }
}

/**
 * Update an existing marketplace item
 * 
 * @param itemId - Item UUID
 * @param wallet - Wallet address (must be creator)
 * @param updates - Partial update data
 * @returns Updated item or null
 */
export async function updateItem(
  itemId: string,
  wallet: string,
  updates: Partial<CreateItemData>
): Promise<MarketplaceItem | null> {
  try {
    const [existing] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, itemId))
      .limit(1);

    if (!existing || existing.creatorWallet !== wallet) {
      return null;
    }

    const updateData: Record<string, unknown> = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.thumbnail !== undefined) updateData.thumbnail = updates.thumbnail;
    if (updates.coverImage !== undefined) updateData.coverImage = updates.coverImage;
    if (updates.priceWei !== undefined) updateData.priceWei = updates.priceWei;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.manifest !== undefined) updateData.manifest = updates.manifest;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status === 'published' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const [updated] = await db
      .update(marketplaceItems)
      .set(updateData)
      .where(eq(marketplaceItems.id, itemId))
      .returning();

    const requestId = generateRequestId();
    await db.insert(marketplaceReceiptsTable).values({
      wallet,
      kind: 'item.update',
      refId: itemId,
      refType: 'marketplace_item',
      metaJson: { updates: Object.keys(updates) },
      requestId,
    });

    try {
      const { incrementLensVersion } = await import('../one/catalog/lensService');
      await incrementLensVersion(itemId);
    } catch (lensErr) {
      console.warn('Failed to update lens versions:', lensErr);
    }

    return updated;
  } catch (err) {
    console.error('Error updating marketplace item:', err);
    return null;
  }
}

/**
 * Publish an item (change status to published)
 * 
 * @param itemId - Item UUID
 * @param wallet - Wallet address (must be creator)
 * @returns Updated item or null
 */
export async function publishItem(
  itemId: string,
  wallet: string
): Promise<MarketplaceItem | null> {
  return updateItem(itemId, wallet, { status: 'published' });
}

/**
 * Get a single item by ID
 * 
 * @param itemId - Item UUID
 * @returns Item or null
 */
export async function getItem(itemId: string): Promise<MarketplaceItem | null> {
  try {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, itemId))
      .limit(1);

    return item || null;
  } catch (err) {
    console.error('Error getting item:', err);
    return null;
  }
}

/**
 * Get item by slug
 * 
 * @param slug - Item slug
 * @returns Item or null
 */
export async function getItemBySlug(slug: string): Promise<MarketplaceItem | null> {
  try {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.slug, slug))
      .limit(1);

    return item || null;
  } catch (err) {
    console.error('Error getting item by slug:', err);
    return null;
  }
}

// =============================================================================
// UNIFIED SEARCH
// =============================================================================

/**
 * Search marketplace items with filters
 * 
 * Searches across all item types with optional filters for type, category,
 * tags, text search, status, and pagination.
 * 
 * @param filters - Search filters
 * @returns Object with items array and total count
 */
export async function searchItems(filters?: SearchFilters): Promise<SearchResult> {
  const conditions = [];

  if (filters?.type) {
    conditions.push(eq(marketplaceItems.itemType, filters.type));
  }

  if (filters?.category) {
    conditions.push(eq(marketplaceItems.category, filters.category));
  }

  if (filters?.status) {
    conditions.push(eq(marketplaceItems.status, filters.status));
  }

  if (filters?.featured !== undefined) {
    conditions.push(eq(marketplaceItems.featured, filters.featured));
  }

  if (filters?.creatorWallet) {
    conditions.push(eq(marketplaceItems.creatorWallet, filters.creatorWallet));
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(marketplaceItems.title, `%${filters.search}%`),
        ilike(marketplaceItems.description, `%${filters.search}%`)
      )
    );
  }

  if (filters?.tags && filters.tags.length > 0) {
    conditions.push(
      sql`${marketplaceItems.tags} && ${filters.tags}`
    );
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  try {
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceItems)
      .where(whereClause);

    const items = await db
      .select()
      .from(marketplaceItems)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(marketplaceItems.updatedAt));

    return {
      items,
      count: countResult?.count ?? 0,
    };
  } catch (err) {
    console.error('Error searching items:', err);
    return { items: [], count: 0 };
  }
}

/**
 * Get items by type
 * 
 * @param type - Item type
 * @param limit - Max results
 * @param offset - Pagination offset
 * @returns Search result
 */
export async function getItemsByType(
  type: ItemType,
  limit: number = 50,
  offset: number = 0
): Promise<SearchResult> {
  return searchItems({ type, status: 'published', limit, offset });
}

/**
 * Get featured items
 * 
 * @param type - Optional item type filter
 * @param limit - Max results
 * @returns Search result
 */
export async function getFeaturedItems(
  type?: ItemType,
  limit: number = 20
): Promise<SearchResult> {
  return searchItems({ type, featured: true, status: 'published', limit });
}

// =============================================================================
// MEDIA ASSET MANAGEMENT
// =============================================================================

/**
 * Add a media asset to an item
 * 
 * Used for ebooks, videos, audio files and other streamable content.
 * 
 * @param itemId - Parent item UUID
 * @param assetData - Asset metadata
 * @returns Created asset or null
 */
export async function addMediaAsset(
  itemId: string,
  assetData: MediaAssetData
): Promise<MediaAsset | null> {
  try {
    const [existing] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, itemId))
      .limit(1);

    if (!existing) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const insertData: InsertMediaAsset = {
      itemId,
      assetType: assetData.assetType,
      url: assetData.url,
      mimeType: assetData.mimeType ?? null,
      duration: assetData.duration ?? null,
      pageCount: assetData.pageCount ?? null,
      fileSize: assetData.fileSize ?? null,
      resolution: assetData.resolution ?? null,
      bitrate: assetData.bitrate ?? null,
      language: assetData.language ?? 'en',
      subtitles: assetData.subtitles ?? null,
      chapters: assetData.chapters ?? null,
      metadata: assetData.metadata ?? null,
    };

    const [asset] = await db
      .insert(mediaAssets)
      .values(insertData)
      .returning();

    const requestId = generateRequestId();
    await db.insert(marketplaceReceiptsTable).values({
      wallet: existing.creatorWallet,
      kind: 'media.upload',
      refId: asset.id,
      refType: 'media_asset',
      metaJson: {
        itemId,
        assetType: assetData.assetType,
        mimeType: assetData.mimeType,
      },
      requestId,
    });

    return asset;
  } catch (err) {
    console.error('Error adding media asset:', err);
    return null;
  }
}

/**
 * Get all media assets for an item
 * 
 * @param itemId - Item UUID
 * @returns Array of media assets
 */
export async function getMediaAssets(itemId: string): Promise<MediaAsset[]> {
  try {
    return await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.itemId, itemId))
      .orderBy(asc(mediaAssets.createdAt));
  } catch (err) {
    console.error('Error getting media assets:', err);
    return [];
  }
}

/**
 * Get a single media asset by ID
 * 
 * @param assetId - Asset UUID
 * @returns Asset or null
 */
export async function getMediaAsset(assetId: string): Promise<MediaAsset | null> {
  try {
    const [asset] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, assetId))
      .limit(1);

    return asset || null;
  } catch (err) {
    console.error('Error getting media asset:', err);
    return null;
  }
}

/**
 * Delete a media asset
 * 
 * @param assetId - Asset UUID
 * @param wallet - Wallet address (must be item creator)
 * @returns True if deleted
 */
export async function deleteMediaAsset(
  assetId: string,
  wallet: string
): Promise<boolean> {
  try {
    const [asset] = await db
      .select({
        asset: mediaAssets,
        item: marketplaceItems,
      })
      .from(mediaAssets)
      .innerJoin(marketplaceItems, eq(mediaAssets.itemId, marketplaceItems.id))
      .where(eq(mediaAssets.id, assetId))
      .limit(1);

    if (!asset || asset.item.creatorWallet !== wallet) {
      return false;
    }

    await db
      .delete(mediaAssets)
      .where(eq(mediaAssets.id, assetId));

    return true;
  } catch (err) {
    console.error('Error deleting media asset:', err);
    return false;
  }
}

// =============================================================================
// CATEGORY OPERATIONS
// =============================================================================

/**
 * Get all categories from category_registry
 * 
 * @param activeOnly - Only return active categories
 * @returns Categories with count
 */
export async function getCategories(activeOnly: boolean = true): Promise<CategoryResult> {
  try {
    const conditions = activeOnly ? [eq(categoryRegistry.active, true)] : [];

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categoryRegistry)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const categories = await db
      .select()
      .from(categoryRegistry)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(categoryRegistry.sortOrder), asc(categoryRegistry.name));

    return {
      categories,
      count: countResult?.count ?? 0,
    };
  } catch (err) {
    console.error('Error getting categories:', err);
    return { categories: [], count: 0 };
  }
}

/**
 * Get a category by slug
 * 
 * @param slug - Category slug
 * @returns Category or null
 */
export async function getCategory(slug: string): Promise<CategoryRegistry | null> {
  try {
    const [category] = await db
      .select()
      .from(categoryRegistry)
      .where(eq(categoryRegistry.slug, slug))
      .limit(1);

    return category || null;
  } catch (err) {
    console.error('Error getting category:', err);
    return null;
  }
}

/**
 * Get items in a category
 * 
 * @param slug - Category slug
 * @param type - Optional item type filter
 * @param limit - Max results
 * @param offset - Pagination offset
 * @returns Items in category with count
 */
export async function getCategoryItems(
  slug: string,
  type?: ItemType,
  limit: number = 50,
  offset: number = 0
): Promise<SearchResult> {
  return searchItems({
    category: slug,
    type,
    status: 'published',
    limit,
    offset,
  });
}

/**
 * Get featured categories
 * 
 * @returns Featured categories
 */
export async function getFeaturedCategories(): Promise<CategoryRegistry[]> {
  try {
    return await db
      .select()
      .from(categoryRegistry)
      .where(
        and(
          eq(categoryRegistry.featured, true),
          eq(categoryRegistry.active, true)
        )
      )
      .orderBy(asc(categoryRegistry.sortOrder));
  } catch (err) {
    console.error('Error getting featured categories:', err);
    return [];
  }
}

// =============================================================================
// MERCHANT STORE OPERATIONS
// =============================================================================

/**
 * Get or create a merchant store for a wallet
 * 
 * Ensures a merchant_stores entry exists for the given wallet.
 * Creates a default store if one doesn't exist.
 * 
 * @param wallet - Wallet address
 * @param storeName - Optional store name (used for creation)
 * @returns Merchant store or null
 */
export async function getOrCreateStore(
  wallet: string,
  storeName?: string
): Promise<MerchantStore | null> {
  try {
    const [existing] = await db
      .select()
      .from(merchantStores)
      .where(eq(merchantStores.wallet, wallet))
      .limit(1);

    if (existing) {
      return existing;
    }

    const name = storeName || `Store ${wallet.slice(0, 8)}`;
    const slug = generateSlug(name, wallet.slice(2, 10));

    const insertData: InsertMerchantStore = {
      wallet,
      name,
      slug,
      description: null,
      logo: null,
      banner: null,
      category: null,
      verified: false,
      rating: null,
      totalSales: 0,
      totalRevenue: '0',
      metadata: null,
      status: 'active',
    };

    const [store] = await db
      .insert(merchantStores)
      .values(insertData)
      .returning();

    const requestId = generateRequestId();
    await db.insert(marketplaceReceiptsTable).values({
      wallet,
      kind: 'store.create',
      refId: store.id,
      refType: 'merchant_store',
      metaJson: { name, slug },
      requestId,
    });

    return store;
  } catch (err) {
    console.error('Error getting/creating store:', err);
    return null;
  }
}

/**
 * Update a merchant store
 * 
 * @param wallet - Wallet address (must be store owner)
 * @param updates - Store updates
 * @returns Updated store or null
 */
export async function updateStore(
  wallet: string,
  updates: Partial<Pick<MerchantStore, 'name' | 'description' | 'logo' | 'banner' | 'category' | 'metadata'>>
): Promise<MerchantStore | null> {
  try {
    const [updated] = await db
      .update(merchantStores)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(merchantStores.wallet, wallet))
      .returning();

    if (updated) {
      const requestId = generateRequestId();
      await db.insert(marketplaceReceiptsTable).values({
        wallet,
        kind: 'store.update',
        refId: updated.id,
        refType: 'merchant_store',
        metaJson: { updates: Object.keys(updates) },
        requestId,
      });
    }

    return updated || null;
  } catch (err) {
    console.error('Error updating store:', err);
    return null;
  }
}

/**
 * Get a store by wallet
 * 
 * @param wallet - Wallet address
 * @returns Store or null
 */
export async function getStore(wallet: string): Promise<MerchantStore | null> {
  try {
    const [store] = await db
      .select()
      .from(merchantStores)
      .where(eq(merchantStores.wallet, wallet))
      .limit(1);

    return store || null;
  } catch (err) {
    console.error('Error getting store:', err);
    return null;
  }
}

/**
 * Get a store by slug
 * 
 * @param slug - Store slug
 * @returns Store or null
 */
export async function getStoreBySlug(slug: string): Promise<MerchantStore | null> {
  try {
    const [store] = await db
      .select()
      .from(merchantStores)
      .where(eq(merchantStores.slug, slug))
      .limit(1);

    return store || null;
  } catch (err) {
    console.error('Error getting store by slug:', err);
    return null;
  }
}

/**
 * Get all items for a store/creator wallet
 * 
 * @param wallet - Creator wallet address
 * @param status - Optional status filter
 * @param limit - Max results
 * @param offset - Pagination offset
 * @returns Items with count and store info
 */
export async function getStoreItems(
  wallet: string,
  status?: 'draft' | 'published' | 'archived' | 'suspended',
  limit: number = 50,
  offset: number = 0
): Promise<StoreItemsResult> {
  try {
    const store = await getStore(wallet);
    const result = await searchItems({
      creatorWallet: wallet,
      status,
      limit,
      offset,
    });

    return {
      ...result,
      store,
    };
  } catch (err) {
    console.error('Error getting store items:', err);
    return { items: [], count: 0, store: null };
  }
}

/**
 * Get all verified stores
 * 
 * @param limit - Max results
 * @returns Array of verified stores
 */
export async function getVerifiedStores(limit: number = 50): Promise<MerchantStore[]> {
  try {
    return await db
      .select()
      .from(merchantStores)
      .where(
        and(
          eq(merchantStores.verified, true),
          eq(merchantStores.status, 'active')
        )
      )
      .limit(limit)
      .orderBy(desc(merchantStores.totalSales));
  } catch (err) {
    console.error('Error getting verified stores:', err);
    return [];
  }
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get catalog statistics
 * 
 * @returns Counts by item type and status
 */
export async function getCatalogStats(): Promise<{
  totalItems: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  totalStores: number;
  totalCategories: number;
}> {
  try {
    const [itemCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceItems);

    const typeStats = await db
      .select({
        itemType: marketplaceItems.itemType,
        count: sql<number>`count(*)::int`,
      })
      .from(marketplaceItems)
      .groupBy(marketplaceItems.itemType);

    const statusStats = await db
      .select({
        status: marketplaceItems.status,
        count: sql<number>`count(*)::int`,
      })
      .from(marketplaceItems)
      .groupBy(marketplaceItems.status);

    const [storeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(merchantStores);

    const [categoryCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categoryRegistry)
      .where(eq(categoryRegistry.active, true));

    return {
      totalItems: itemCount?.count ?? 0,
      byType: Object.fromEntries(typeStats.map(s => [s.itemType, s.count])),
      byStatus: Object.fromEntries(statusStats.map(s => [s.status, s.count])),
      totalStores: storeCount?.count ?? 0,
      totalCategories: categoryCount?.count ?? 0,
    };
  } catch (err) {
    console.error('Error getting catalog stats:', err);
    return {
      totalItems: 0,
      byType: {},
      byStatus: {},
      totalStores: 0,
      totalCategories: 0,
    };
  }
}
