/**
 * REST Baseline Endpoints
 * 
 * These endpoints return the SAME data as their Atlas counterparts,
 * but without Atlas optimizations:
 * - No MessagePack binary encoding (plain JSON)
 * - No session reuse (stateless)
 * - No connection pooling benefits
 * - No delta sync
 * 
 * Used to generate fair baseline metrics for efficiency comparison.
 */

import { Router, Request, Response } from 'express';
import { manifestRegistry } from '../atlas/core/registry';
import { searchAtlasOne } from '../atlas/one/catalog';

const router = Router();

/**
 * REST equivalent of /atlas/canvas/renderables
 * Returns the EXACT same data as Atlas - uses the same getCanvasRenderables() method.
 * The ONLY difference is that Atlas applies MessagePack encoding + gzip compression.
 */
router.get('/renderables', async (_req: Request, res: Response) => {
  try {
    // Use the EXACT same method as Atlas canvas endpoint
    const renderables = manifestRegistry.getCanvasRenderables();
    
    // Return identical structure to Atlas endpoint
    const response = {
      ok: true,
      count: renderables.length,
      renderables,
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch renderables' });
  }
});

/**
 * REST equivalent of /atlas/one/catalog/search
 * Returns the EXACT same data structure as Atlas catalog endpoint.
 */
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const { search, kind, limit = '20' } = req.query;
    
    const results = await searchAtlasOne({
      search: search as string,
      kind: kind as any,
      limit: parseInt(limit as string, 10),
    });
    
    // Return identical structure to Atlas catalog endpoint
    const response = {
      ok: true,
      count: results.count,
      items: results.items,
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch catalog' });
  }
});

/**
 * REST equivalent of /atlas/session/start
 * Returns same auth response structure.
 */
router.post('/auth', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;
    
    const response = {
      ok: true,
      authenticated: !!wallet,
      wallet: wallet || null,
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Auth failed' });
  }
});

/**
 * REST equivalent of /atlas/settings
 * Returns same settings structure.
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    
    const response = {
      ok: true,
      settings: {
        wallet: wallet || 'anonymous',
        theme: 'dark',
        notifications: true,
        language: 'en',
      },
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch settings' });
  }
});

/**
 * REST equivalent of /atlas/mesh/connected
 * Returns same mesh status structure.
 */
router.get('/mesh-status', async (_req: Request, res: Response) => {
  try {
    const response = {
      ok: true,
      connected: true,
      nodes: [],
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch mesh status' });
  }
});

export const restBaselineRouter = router;
