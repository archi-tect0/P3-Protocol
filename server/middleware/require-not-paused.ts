import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { protocolState } from '@shared/schema';
import { desc } from 'drizzle-orm';

interface PauseCache {
  paused: boolean;
  reason: string | null;
  cachedAt: number;
}

let pauseCache: PauseCache | null = null;
const CACHE_TTL_MS = 5000;

async function fetchPauseState(): Promise<PauseCache> {
  try {
    const [state] = await db
      .select({
        paused: protocolState.paused,
        reason: protocolState.reason,
      })
      .from(protocolState)
      .orderBy(desc(protocolState.updatedAt))
      .limit(1);

    return {
      paused: state?.paused ?? false,
      reason: state?.reason ?? null,
      cachedAt: Date.now(),
    };
  } catch (error) {
    console.error('[PAUSE-MIDDLEWARE] Error fetching pause state:', error);
    return {
      paused: false,
      reason: null,
      cachedAt: Date.now(),
    };
  }
}

async function getPauseState(): Promise<PauseCache> {
  const now = Date.now();
  
  if (pauseCache && (now - pauseCache.cachedAt) < CACHE_TTL_MS) {
    return pauseCache;
  }
  
  pauseCache = await fetchPauseState();
  return pauseCache;
}

export function invalidatePauseCache(): void {
  pauseCache = null;
}

export async function requireNotPaused(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const state = await getPauseState();

    if (state.paused) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Protocol is currently paused for maintenance or emergency',
        paused: true,
        reason: state.reason || 'Protocol pause in effect',
        retryAfter: 60,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[PAUSE-MIDDLEWARE] Unexpected error:', error);
    next();
  }
}

export default requireNotPaused;
