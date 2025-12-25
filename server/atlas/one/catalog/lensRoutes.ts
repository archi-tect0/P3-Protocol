/**
 * Lens Routes - Atlas API 2.0 Manifest Lenses
 * 
 * API endpoints for lens operations:
 * - GET /lens/:itemId/:lensType - Get specific lens for an item
 * - POST /lens/batch - Batch lens fetch for viewport optimization
 * - GET /lens/:itemId/delta - Get delta changes since a version
 */

import { Router, Request, Response } from 'express';
import {
  generateLens,
  generateCardLens,
  generateQuickviewLens,
  generatePlaybackLens,
  getDelta,
  getLensVersion,
  getViewportBatch,
  refreshLensForItem,
  storeLensVersion,
} from './lensService';
import {
  getDeltaSince,
  getLensStats,
  getDeltaHistory,
  pruneOldVersions,
} from './lensStore';
import type { LensType, ViewportBatchRequest } from '../types';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[LensRoutes] ${msg}`),
  error: (msg: string) => console.error(`[LensRoutes] ${msg}`),
};

const VALID_LENS_TYPES = ['card', 'quickview', 'playback'];

function validateLensType(lensType: string): lensType is LensType {
  return VALID_LENS_TYPES.includes(lensType);
}

/**
 * GET /lens/:itemId/:lensType
 * Get specific lens for an item
 * 
 * Response: { itemId, lensType, lens, version }
 */
router.get('/:itemId/:lensType', async (req: Request, res: Response) => {
  try {
    const { itemId, lensType } = req.params;

    if (!validateLensType(lensType)) {
      return res.status(400).json({ 
        error: 'Invalid lensType',
        validTypes: VALID_LENS_TYPES,
      });
    }

    const lens = await generateLens(itemId, lensType as LensType);
    
    if (!lens) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const versionRecord = await getLensVersion(itemId, lensType as LensType);
    const version = versionRecord?.version || 1;

    if (!versionRecord) {
      await storeLensVersion(itemId, lensType as LensType, lens);
    }

    res.json({
      itemId,
      lensType,
      lens,
      version,
    });
  } catch (err: any) {
    logger.error(`Lens fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /lens/:itemId/delta
 * Get delta changes since a specific version
 * 
 * Query params:
 * - since: Version number to get changes from
 * 
 * Response: { itemId, lensType, hasChanges, delta?, currentVersion, changedFields }
 */
router.get('/:itemId/delta', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { since, lensType } = req.query;

    if (!since) {
      return res.status(400).json({ error: 'since query param required' });
    }

    const type = (lensType as string) || 'card';
    
    if (!validateLensType(type)) {
      return res.status(400).json({ 
        error: 'Invalid lensType',
        validTypes: VALID_LENS_TYPES,
      });
    }

    const sinceVersion = parseInt(since as string);
    
    if (isNaN(sinceVersion) || sinceVersion < 0) {
      return res.status(400).json({ error: 'Invalid since version' });
    }

    const delta = await getDelta(itemId, type as LensType, sinceVersion);
    
    if (!delta) {
      const versionRecord = await getLensVersion(itemId, type as LensType);
      return res.json({ 
        itemId, 
        lensType: type, 
        hasChanges: false,
        currentVersion: versionRecord?.version || 0,
      });
    }

    res.json({
      itemId,
      lensType: type,
      hasChanges: true,
      delta,
      currentVersion: delta.version,
      changedFields: delta.changedFields,
    });
  } catch (err: any) {
    logger.error(`Delta fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /lens/batch
 * Batch lens fetch for viewport optimization
 * 
 * Request body:
 * - sessionId: string - Client session identifier
 * - itemIds: string[] - Array of item IDs to fetch
 * - lensType: LensType - Type of lens to generate
 * - clientVersions?: Record<string, number> - Optional map of item ID to client's known version
 * 
 * Response: { items: Array<{ itemId, lens, version, delta? }>, count }
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { sessionId, itemIds, lensType, clientVersions } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds array required' });
    }

    if (itemIds.length === 0) {
      return res.json({ items: [], count: 0 });
    }

    if (itemIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 items per batch' });
    }

    if (!lensType || !validateLensType(lensType)) {
      return res.status(400).json({ 
        error: 'Valid lensType required',
        validTypes: VALID_LENS_TYPES,
      });
    }

    const request: ViewportBatchRequest = {
      sessionId,
      itemIds,
      lensType: lensType as LensType,
      clientVersions,
    };

    const result = await getViewportBatch(request);
    
    logger.info(`Batch fetch: ${itemIds.length} items, ${result.count} returned`);
    
    res.json(result);
  } catch (err: any) {
    logger.error(`Batch fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /lens/:itemId/refresh
 * Force refresh all lens versions for an item
 */
router.post('/:itemId/refresh', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    await refreshLensForItem(itemId);
    
    res.json({ 
      success: true, 
      itemId, 
      message: 'All lenses refreshed',
      lensTypes: VALID_LENS_TYPES,
    });
  } catch (err: any) {
    logger.error(`Lens refresh failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /lens/:itemId/:lensType/history
 * Get delta history for a specific lens
 */
router.get('/:itemId/:lensType/history', async (req: Request, res: Response) => {
  try {
    const { itemId, lensType } = req.params;
    const { limit } = req.query;

    if (!validateLensType(lensType)) {
      return res.status(400).json({ 
        error: 'Invalid lensType',
        validTypes: VALID_LENS_TYPES,
      });
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

/**
 * GET /lens/stats
 * Get overall lens statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getLensStats();
    res.json(stats);
  } catch (err: any) {
    logger.error(`Stats fetch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /lens/prune
 * Prune old lens delta history
 */
router.post('/prune', async (req: Request, res: Response) => {
  try {
    const { days } = req.body;
    const result = await pruneOldVersions(days || 30);
    res.json({ 
      success: true, 
      ...result,
      message: `Pruned deltas older than ${days || 30} days`,
    });
  } catch (err: any) {
    logger.error(`Prune failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
