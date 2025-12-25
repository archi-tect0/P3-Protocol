/**
 * Lens Service - Manifest Lenses for Atlas API 2.0
 * 
 * Generates optimized content slices (lenses) for viewport rendering:
 * - Card lens: Minimal data for grid/list displays (id, title, type, art, accessHint, version)
 * - Quickview lens: Extended data for previews/modals (...card, description, provider, rating)
 * - Playback lens: Full manifest for content playback (...quickview, access, metadata, chapters)
 * 
 * Features:
 * - Deterministic lens generation from marketplaceItems
 * - Version tracking with checksums for delta updates
 * - Batch operations for viewport efficiency
 */

import { db } from '../../../db';
import {
  marketplaceItems,
  mediaAssets,
  lensVersions,
  type MarketplaceItem,
  type LensVersion,
  type CardLens,
  type QuickviewLens,
  type PlaybackLens,
  type LensType,
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { LensDelta, ViewportBatchRequest, ViewportBatchResponse } from '../types';

const logger = {
  info: (msg: string) => console.log(`[LensService] ${msg}`),
  error: (msg: string) => console.error(`[LensService] ${msg}`),
};

function generateChecksum(payload: Record<string, unknown>): string {
  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

function determineAccessHint(
  item: MarketplaceItem,
  walletOwned?: boolean
): CardLens['accessHint'] {
  if (walletOwned) return 'owned';
  
  const priceWei = BigInt(item.priceWei || '0');
  if (priceWei === 0n) return 'free';
  
  const accessMode = item.access?.mode;
  if (accessMode === 'rental') return 'rental';
  if (accessMode === 'subscription') return 'subscription';
  
  return 'purchase';
}

export function generateCardLens(
  item: MarketplaceItem,
  walletOwned?: boolean,
  version: number = 1
): CardLens {
  return {
    id: item.id,
    title: item.title,
    type: item.itemType,
    art: item.thumbnail || item.coverImage || undefined,
    accessHint: determineAccessHint(item, walletOwned),
    version,
  };
}

export function generateQuickviewLens(
  item: MarketplaceItem,
  mediaAsset?: { duration?: number | null; pageCount?: number | null } | null,
  walletOwned?: boolean,
  version: number = 1
): QuickviewLens {
  const card = generateCardLens(item, walletOwned, version);
  const metadata = item.metadata as Record<string, unknown> | null;
  
  return {
    ...card,
    description: item.description || undefined,
    provider: (metadata?.provider as string) || (metadata?.developer as string) || item.creatorWallet,
    rating: item.rating ? parseFloat(item.rating) : undefined,
    duration: mediaAsset?.duration || undefined,
    pages: mediaAsset?.pageCount || undefined,
    category: item.category,
    tags: item.tags || undefined,
  };
}

export function generatePlaybackLens(
  item: MarketplaceItem,
  mediaAsset?: { duration?: number | null; pageCount?: number | null; chapters?: Array<{ title: string; startTime?: number; startPage?: number; duration?: number }> } | null,
  walletOwned?: boolean,
  version: number = 1
): PlaybackLens {
  const quickview = generateQuickviewLens(item, mediaAsset, walletOwned, version);
  const metadata = item.metadata as Record<string, unknown> | null;
  
  const capabilities: string[] = [];
  if (item.access?.mode === 'rental') capabilities.push('rental');
  if (item.access?.mode === 'purchase') capabilities.push('purchase');
  if (item.access?.mode === 'subscription') capabilities.push('subscription');
  if (item.access?.format === 'stream') capabilities.push('stream');
  if (item.access?.format === 'download') capabilities.push('download');
  if (metadata?.drm) capabilities.push('drm');
  if (metadata?.offline) capabilities.push('offline');
  if (metadata?.hd) capabilities.push('hd');
  if (metadata?.['4k']) capabilities.push('4k');
  
  const chapters = mediaAsset?.chapters || (metadata?.chapters as PlaybackLens['chapters']) || undefined;
  
  return {
    ...quickview,
    access: item.access || undefined,
    metadata: metadata || undefined,
    chapters,
    priceWei: item.priceWei || undefined,
    currency: item.currency || 'ETH',
    capabilities: capabilities.length > 0 ? capabilities : undefined,
  };
}

export async function generateLens(
  itemId: string,
  lensType: LensType,
  walletOwned?: boolean
): Promise<CardLens | QuickviewLens | PlaybackLens | null> {
  try {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, itemId))
      .limit(1);

    if (!item) {
      logger.error(`Item not found: ${itemId}`);
      return null;
    }

    let mediaAsset: { duration?: number | null; pageCount?: number | null } | null = null;
    
    if (lensType !== 'card') {
      const assets = await db
        .select({ duration: mediaAssets.duration, pageCount: mediaAssets.pageCount })
        .from(mediaAssets)
        .where(eq(mediaAssets.itemId, itemId))
        .limit(1);
      
      if (assets.length > 0) {
        mediaAsset = assets[0];
      }
    }

    switch (lensType) {
      case 'card':
        return generateCardLens(item, walletOwned);
      case 'quickview':
        return generateQuickviewLens(item, mediaAsset, walletOwned);
      case 'playback':
        return generatePlaybackLens(item, mediaAsset, walletOwned);
      default:
        return null;
    }
  } catch (error) {
    logger.error(`Failed to generate lens: ${error}`);
    return null;
  }
}

export async function storeLensVersion(
  itemId: string,
  lensType: LensType,
  payload: Record<string, unknown>
): Promise<LensVersion | null> {
  try {
    const checksum = generateChecksum(payload);

    const existing = await db
      .select()
      .from(lensVersions)
      .where(
        and(
          eq(lensVersions.itemId, itemId),
          eq(lensVersions.lensType, lensType)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      
      if (current.checksum === checksum) {
        return current;
      }

      const [updated] = await db
        .update(lensVersions)
        .set({
          version: current.version + 1,
          payload,
          checksum,
        })
        .where(eq(lensVersions.id, current.id))
        .returning();

      logger.info(`Updated lens version ${itemId}/${lensType} to v${updated.version}`);
      return updated;
    }

    const [created] = await db
      .insert(lensVersions)
      .values({
        itemId,
        lensType,
        version: 1,
        payload,
        checksum,
      })
      .returning();

    logger.info(`Created lens ${itemId}/${lensType} v1`);
    return created;
  } catch (error) {
    logger.error(`Failed to store lens version: ${error}`);
    return null;
  }
}

export async function getLensVersion(
  itemId: string,
  lensType: LensType
): Promise<LensVersion | null> {
  try {
    const [version] = await db
      .select()
      .from(lensVersions)
      .where(
        and(
          eq(lensVersions.itemId, itemId),
          eq(lensVersions.lensType, lensType)
        )
      )
      .limit(1);

    return version || null;
  } catch (error) {
    logger.error(`Failed to get lens version: ${error}`);
    return null;
  }
}

export async function getDelta(
  itemId: string,
  lensType: LensType,
  sinceVersion: number
): Promise<LensDelta | null> {
  try {
    const lens = await generateLens(itemId, lensType);
    if (!lens) return null;

    const currentVersion = await getLensVersion(itemId, lensType);
    
    if (!currentVersion || currentVersion.version <= sinceVersion) {
      return null;
    }

    const previousPayload = currentVersion.version > 1 
      ? (currentVersion.payload as Record<string, unknown>)
      : {};

    const changedFields: string[] = [];
    const deltaPayload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(lens)) {
      if (JSON.stringify(value) !== JSON.stringify(previousPayload[key])) {
        changedFields.push(key);
        deltaPayload[key] = value;
      }
    }

    if (changedFields.length === 0) {
      return null;
    }

    return {
      itemId,
      lensType,
      version: currentVersion.version,
      previousVersion: sinceVersion,
      changedFields,
      payload: deltaPayload,
    };
  } catch (error) {
    logger.error(`Failed to get delta: ${error}`);
    return null;
  }
}

export async function refreshLensForItem(
  itemId: string,
  walletOwned?: boolean
): Promise<void> {
  try {
    for (const lensType of ['card', 'quickview', 'playback'] as LensType[]) {
      const lens = await generateLens(itemId, lensType, walletOwned);
      if (lens) {
        await storeLensVersion(itemId, lensType, lens);
      }
    }
    logger.info(`Refreshed all lenses for item ${itemId}`);
  } catch (error) {
    logger.error(`Failed to refresh lenses: ${error}`);
  }
}

export async function getViewportBatch(
  request: ViewportBatchRequest
): Promise<ViewportBatchResponse> {
  const { itemIds, lensType, clientVersions } = request;
  
  const results: ViewportBatchResponse['items'] = [];

  try {
    const items = await db
      .select()
      .from(marketplaceItems)
      .where(inArray(marketplaceItems.id, itemIds));

    const itemMap = new Map(items.map(item => [item.id, item]));

    let mediaAssetMap = new Map<string, { duration?: number | null; pageCount?: number | null }>();
    
    if (lensType !== 'card') {
      const assets = await db
        .select({
          itemId: mediaAssets.itemId,
          duration: mediaAssets.duration,
          pageCount: mediaAssets.pageCount,
        })
        .from(mediaAssets)
        .where(inArray(mediaAssets.itemId, itemIds));

      mediaAssetMap = new Map(
        assets.map(a => [a.itemId, { duration: a.duration, pageCount: a.pageCount }])
      );
    }

    const existingVersions = await db
      .select()
      .from(lensVersions)
      .where(
        and(
          inArray(lensVersions.itemId, itemIds),
          eq(lensVersions.lensType, lensType)
        )
      );

    const versionMap = new Map(
      existingVersions.map(v => [v.itemId, v])
    );

    for (const itemId of itemIds) {
      const item = itemMap.get(itemId);
      if (!item) continue;

      const mediaAsset = mediaAssetMap.get(itemId);
      let lens: Record<string, unknown>;

      switch (lensType) {
        case 'card':
          lens = generateCardLens(item);
          break;
        case 'quickview':
          lens = generateQuickviewLens(item, mediaAsset);
          break;
        case 'playback':
          lens = generatePlaybackLens(item, mediaAsset);
          break;
        default:
          continue;
      }

      let existingVersion = versionMap.get(itemId);
      
      if (!existingVersion) {
        const stored = await storeLensVersion(itemId, lensType, lens);
        if (stored) {
          existingVersion = stored;
        }
      }

      const version = existingVersion?.version || 1;

      const clientVersion = clientVersions?.[itemId];
      let delta: LensDelta | undefined;

      if (clientVersion && clientVersion < version) {
        const changedFields: string[] = [];
        const deltaPayload: Record<string, unknown> = {};
        const previousPayload = (existingVersion?.payload as Record<string, unknown>) || {};

        for (const [key, value] of Object.entries(lens)) {
          if (JSON.stringify(value) !== JSON.stringify(previousPayload[key])) {
            changedFields.push(key);
            deltaPayload[key] = value;
          }
        }

        if (changedFields.length > 0) {
          delta = {
            itemId,
            lensType,
            version,
            previousVersion: clientVersion,
            changedFields,
            payload: deltaPayload,
          };
        }
      }

      results.push({
        itemId,
        lens,
        version,
        delta,
      });
    }

    return {
      items: results,
      count: results.length,
    };
  } catch (error) {
    logger.error(`Failed to get viewport batch: ${error}`);
    return { items: [], count: 0 };
  }
}

export async function incrementLensVersion(itemId: string): Promise<void> {
  try {
    await refreshLensForItem(itemId);
  } catch (error) {
    logger.error(`Failed to increment lens version: ${error}`);
  }
}
