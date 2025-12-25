/**
 * Access Manifest Backfill
 * 
 * Populates existing catalog items with access manifests.
 * Runs on startup and can be triggered manually via admin API.
 */

import { db } from '../../../db';
import { marketplaceItems } from '@shared/schema';
import { isNull, or, sql } from 'drizzle-orm';
import { resolveAccess } from '../../core/access/index';

const logger = {
  info: (msg: string) => console.log(`[AccessBackfill] ${msg}`),
  error: (msg: string) => console.error(`[AccessBackfill] ${msg}`),
};

interface BackfillResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  byType: Record<string, { updated: number; skipped: number; errors: number }>;
}

export async function backfillAccessManifests(options: {
  batchSize?: number;
  itemType?: string;
  forceUpdate?: boolean;
  limit?: number;
} = {}): Promise<BackfillResult> {
  const { batchSize = 100, itemType, forceUpdate = false, limit } = options;
  
  const result: BackfillResult = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    byType: {},
  };
  
  logger.info(`Starting access manifest backfill (batchSize=${batchSize}, type=${itemType || 'all'}, force=${forceUpdate})`);
  
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    let query = db.select().from(marketplaceItems);
    
    if (!forceUpdate) {
      query = query.where(isNull(marketplaceItems.access));
    }
    
    if (itemType) {
      query = query.where(sql`${marketplaceItems.itemType} = ${itemType}`);
    }
    
    const items = await query
      .orderBy(marketplaceItems.createdAt)
      .limit(batchSize)
      .offset(offset);
    
    if (items.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const item of items) {
      result.processed++;
      
      const typeStats = result.byType[item.itemType] || { updated: 0, skipped: 0, errors: 0 };
      
      try {
        const accessResult = resolveAccess({
          itemType: item.itemType,
          source: item.source || 'developer',
          providerId: item.providerId || undefined,
          url: (item.metadata as any)?.url || (item.manifest as any)?.apiEndpoint,
          metadata: item.metadata as Record<string, any>,
        });
        
        if (accessResult.access) {
          await db.update(marketplaceItems)
            .set({ 
              access: accessResult.access,
              updatedAt: new Date(),
            })
            .where(sql`${marketplaceItems.id} = ${item.id}`);
          
          result.updated++;
          typeStats.updated++;
        } else {
          result.skipped++;
          typeStats.skipped++;
        }
      } catch (err) {
        result.errors++;
        typeStats.errors++;
        logger.error(`Failed to backfill ${item.id}: ${err}`);
      }
      
      result.byType[item.itemType] = typeStats;
      
      if (limit && result.processed >= limit) {
        hasMore = false;
        break;
      }
    }
    
    if (items.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
    
    logger.info(`Progress: ${result.processed} processed, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);
  }
  
  logger.info(`Backfill complete: ${result.processed} processed, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);
  
  return result;
}

export async function getBackfillStatus(): Promise<{
  totalItems: number;
  withAccess: number;
  withoutAccess: number;
  byType: Record<string, { total: number; withAccess: number; withoutAccess: number }>;
}> {
  const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItems);
  const [withAccessResult] = await db.select({ count: sql<number>`count(*)` }).from(marketplaceItems).where(sql`access IS NOT NULL`);
  
  const byTypeResults = await db.select({
    itemType: marketplaceItems.itemType,
    total: sql<number>`count(*)`,
    withAccess: sql<number>`count(case when access is not null then 1 end)`,
    withoutAccess: sql<number>`count(case when access is null then 1 end)`,
  })
    .from(marketplaceItems)
    .groupBy(marketplaceItems.itemType);
  
  const byType: Record<string, { total: number; withAccess: number; withoutAccess: number }> = {};
  for (const row of byTypeResults) {
    byType[row.itemType] = {
      total: Number(row.total),
      withAccess: Number(row.withAccess),
      withoutAccess: Number(row.withoutAccess),
    };
  }
  
  return {
    totalItems: Number(totalResult.count),
    withAccess: Number(withAccessResult.count),
    withoutAccess: Number(totalResult.count) - Number(withAccessResult.count),
    byType,
  };
}
