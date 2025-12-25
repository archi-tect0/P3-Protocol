/**
 * Lens Store - Persistence layer for manifest lenses
 * 
 * Handles:
 * - Lens version storage with checksums
 * - Delta history tracking for partial hydration
 * - Pruning of old versions after N days
 */

import { db } from '../../../db';
import {
  lensVersions,
  lensDeltas,
  type LensVersion,
  type LensType,
  type InsertLensDelta,
} from '@shared/schema';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

const logger = {
  info: (msg: string) => console.log(`[LensStore] ${msg}`),
  error: (msg: string) => console.error(`[LensStore] ${msg}`),
};

const DEFAULT_PRUNE_DAYS = 30;
const MAX_DELTA_HISTORY = 10;

export function computeChecksum(payload: Record<string, unknown>): string {
  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

export async function storeLens(
  itemId: string,
  lensType: LensType,
  payload: Record<string, unknown>
): Promise<LensVersion | null> {
  try {
    const checksum = computeChecksum(payload);

    const [existing] = await db
      .select()
      .from(lensVersions)
      .where(
        and(
          eq(lensVersions.itemId, itemId),
          eq(lensVersions.lensType, lensType)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.checksum === checksum) {
        return existing;
      }

      const previousPayload = existing.payload as Record<string, unknown>;
      const changedFields: string[] = [];
      const deltaPayload: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(payload)) {
        if (JSON.stringify(value) !== JSON.stringify(previousPayload[key])) {
          changedFields.push(key);
          deltaPayload[key] = value;
        }
      }

      for (const key of Object.keys(previousPayload)) {
        if (!(key in payload)) {
          changedFields.push(key);
          deltaPayload[key] = null;
        }
      }

      if (changedFields.length > 0) {
        await storeDelta({
          itemId,
          lensType,
          fromVersion: existing.version,
          toVersion: existing.version + 1,
          changedFields,
          deltaPayload,
          checksum: computeChecksum(deltaPayload),
        });
      }

      const [updated] = await db
        .update(lensVersions)
        .set({
          version: existing.version + 1,
          payload,
          checksum,
        })
        .where(eq(lensVersions.id, existing.id))
        .returning();

      logger.info(`Updated lens ${itemId}/${lensType} to v${updated.version}`);
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
    logger.error(`Failed to store lens: ${error}`);
    return null;
  }
}

export async function getLens(
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
    logger.error(`Failed to get lens: ${error}`);
    return null;
  }
}

export async function getVersion(
  itemId: string,
  lensType: LensType
): Promise<number> {
  const lens = await getLens(itemId, lensType);
  return lens?.version || 0;
}

async function storeDelta(delta: InsertLensDelta): Promise<void> {
  try {
    await db.insert(lensDeltas).values(delta);

    const existingDeltas = await db
      .select({ id: lensDeltas.id, fromVersion: lensDeltas.fromVersion })
      .from(lensDeltas)
      .where(
        and(
          eq(lensDeltas.itemId, delta.itemId),
          eq(lensDeltas.lensType, delta.lensType)
        )
      )
      .orderBy(desc(lensDeltas.toVersion));

    if (existingDeltas.length > MAX_DELTA_HISTORY) {
      const toDelete = existingDeltas.slice(MAX_DELTA_HISTORY);
      for (const d of toDelete) {
        await db.delete(lensDeltas).where(eq(lensDeltas.id, d.id));
      }
      logger.info(`Pruned ${toDelete.length} old deltas for ${delta.itemId}/${delta.lensType}`);
    }
  } catch (error) {
    logger.error(`Failed to store delta: ${error}`);
  }
}

export async function getDeltaSince(
  itemId: string,
  lensType: LensType,
  sinceVersion: number
): Promise<{
  hasChanges: boolean;
  currentVersion: number;
  changedFields: string[];
  payload: Record<string, unknown>;
} | null> {
  try {
    const currentLens = await getLens(itemId, lensType);
    
    if (!currentLens || currentLens.version <= sinceVersion) {
      return {
        hasChanges: false,
        currentVersion: currentLens?.version || 0,
        changedFields: [],
        payload: {},
      };
    }

    const deltas = await db
      .select()
      .from(lensDeltas)
      .where(
        and(
          eq(lensDeltas.itemId, itemId),
          eq(lensDeltas.lensType, lensType)
        )
      )
      .orderBy(desc(lensDeltas.toVersion));

    const relevantDeltas = deltas.filter(d => d.fromVersion >= sinceVersion);
    
    if (relevantDeltas.length === 0) {
      return {
        hasChanges: true,
        currentVersion: currentLens.version,
        changedFields: Object.keys(currentLens.payload as Record<string, unknown>),
        payload: currentLens.payload as Record<string, unknown>,
      };
    }

    const allChangedFields = new Set<string>();
    const mergedPayload: Record<string, unknown> = {};

    for (const delta of relevantDeltas.reverse()) {
      for (const field of delta.changedFields) {
        allChangedFields.add(field);
      }
      Object.assign(mergedPayload, delta.deltaPayload as Record<string, unknown>);
    }

    return {
      hasChanges: true,
      currentVersion: currentLens.version,
      changedFields: Array.from(allChangedFields),
      payload: mergedPayload,
    };
  } catch (error) {
    logger.error(`Failed to get delta: ${error}`);
    return null;
  }
}

export async function getDeltaHistory(
  itemId: string,
  lensType: LensType,
  limit: number = 10
): Promise<Array<{
  fromVersion: number;
  toVersion: number;
  changedFields: string[];
  createdAt: Date;
}>> {
  try {
    const deltas = await db
      .select({
        fromVersion: lensDeltas.fromVersion,
        toVersion: lensDeltas.toVersion,
        changedFields: lensDeltas.changedFields,
        createdAt: lensDeltas.createdAt,
      })
      .from(lensDeltas)
      .where(
        and(
          eq(lensDeltas.itemId, itemId),
          eq(lensDeltas.lensType, lensType)
        )
      )
      .orderBy(desc(lensDeltas.toVersion))
      .limit(limit);

    return deltas;
  } catch (error) {
    logger.error(`Failed to get delta history: ${error}`);
    return [];
  }
}

export async function pruneOldVersions(
  days: number = DEFAULT_PRUNE_DAYS
): Promise<{ deletedDeltas: number }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await db
      .delete(lensDeltas)
      .where(lt(lensDeltas.createdAt, cutoffDate))
      .returning({ id: lensDeltas.id });

    const deletedCount = result.length;
    
    if (deletedCount > 0) {
      logger.info(`Pruned ${deletedCount} lens deltas older than ${days} days`);
    }

    return { deletedDeltas: deletedCount };
  } catch (error) {
    logger.error(`Failed to prune old versions: ${error}`);
    return { deletedDeltas: 0 };
  }
}

export async function invalidateLens(
  itemId: string,
  lensType?: LensType
): Promise<void> {
  try {
    if (lensType) {
      await db
        .delete(lensVersions)
        .where(
          and(
            eq(lensVersions.itemId, itemId),
            eq(lensVersions.lensType, lensType)
          )
        );
      
      await db
        .delete(lensDeltas)
        .where(
          and(
            eq(lensDeltas.itemId, itemId),
            eq(lensDeltas.lensType, lensType)
          )
        );
      
      logger.info(`Invalidated lens ${itemId}/${lensType}`);
    } else {
      await db
        .delete(lensVersions)
        .where(eq(lensVersions.itemId, itemId));
      
      await db
        .delete(lensDeltas)
        .where(eq(lensDeltas.itemId, itemId));
      
      logger.info(`Invalidated all lenses for ${itemId}`);
    }
  } catch (error) {
    logger.error(`Failed to invalidate lens: ${error}`);
  }
}

export async function getLensStats(): Promise<{
  totalLenses: number;
  totalDeltas: number;
  byLensType: Record<string, number>;
}> {
  try {
    const [lensCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(lensVersions);

    const [deltaCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(lensDeltas);

    const byType = await db
      .select({
        lensType: lensVersions.lensType,
        count: sql<number>`count(*)`,
      })
      .from(lensVersions)
      .groupBy(lensVersions.lensType);

    const byLensType: Record<string, number> = {};
    for (const row of byType) {
      byLensType[row.lensType] = row.count;
    }

    return {
      totalLenses: lensCount?.count || 0,
      totalDeltas: deltaCount?.count || 0,
      byLensType,
    };
  } catch (error) {
    logger.error(`Failed to get lens stats: ${error}`);
    return {
      totalLenses: 0,
      totalDeltas: 0,
      byLensType: {},
    };
  }
}
