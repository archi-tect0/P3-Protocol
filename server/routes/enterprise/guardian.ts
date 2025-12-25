import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { protocolState, guardianTimelocks } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
const GUARDIAN_WALLET = process.env.GUARDIAN_WALLET?.toLowerCase();

interface GuardianRequest extends Request {
  walletAddr?: string;
  isSuperuser?: boolean;
  isGuardian?: boolean;
}

async function requireGuardianOrAdmin(
  req: GuardianRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const addr = req.headers['x-p3-addr'] as string | undefined;

  if (!addr) {
    res.status(403).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  const normalizedAddr = addr.toLowerCase();
  const isSuperuser = ADMIN_WALLET ? normalizedAddr === ADMIN_WALLET : false;
  const isGuardian = GUARDIAN_WALLET ? normalizedAddr === GUARDIAN_WALLET : false;

  if (!isSuperuser && !isGuardian) {
    res.status(403).json({ 
      error: 'Access denied: Requires guardian or admin privileges',
    });
    return;
  }

  req.walletAddr = normalizedAddr;
  req.isSuperuser = isSuperuser;
  req.isGuardian = isGuardian;
  next();
}

const pauseSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

router.post('/pause', requireGuardianOrAdmin, async (req: GuardianRequest, res: Response) => {
  const result = pauseSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { reason } = result.data;

  try {
    const [existing] = await db
      .select()
      .from(protocolState)
      .orderBy(desc(protocolState.updatedAt))
      .limit(1);

    if (existing?.paused) {
      return res.status(400).json({ 
        error: 'Protocol is already paused',
        pausedAt: existing.updatedAt,
        pausedBy: existing.actorWallet,
        reason: existing.reason,
      });
    }

    const pauseData = {
      paused: true,
      reason: reason || 'Emergency pause triggered',
      actorWallet: req.walletAddr!,
      updatedAt: new Date(),
    };

    let protocolRecord;

    if (existing) {
      [protocolRecord] = await db
        .update(protocolState)
        .set(pauseData)
        .where(eq(protocolState.id, existing.id))
        .returning();
    } else {
      [protocolRecord] = await db
        .insert(protocolState)
        .values(pauseData)
        .returning();
    }

    console.log(`[GUARDIAN] Protocol PAUSED by ${req.walletAddr} - Reason: ${reason || 'Emergency pause triggered'}`);

    res.json({
      ok: true,
      paused: true,
      pausedAt: protocolRecord.updatedAt,
      pausedBy: protocolRecord.actorWallet,
      reason: protocolRecord.reason,
      message: 'Protocol has been paused. All protected endpoints will return 503.',
    });
  } catch (error) {
    console.error('[GUARDIAN] Error pausing protocol:', error);
    res.status(500).json({ error: 'Failed to pause protocol' });
  }
});

router.post('/resume', requireGuardianOrAdmin, async (req: GuardianRequest, res: Response) => {
  try {
    const [existing] = await db
      .select()
      .from(protocolState)
      .orderBy(desc(protocolState.updatedAt))
      .limit(1);

    if (!existing?.paused) {
      return res.status(400).json({ 
        error: 'Protocol is not currently paused',
      });
    }

    const [protocolRecord] = await db
      .update(protocolState)
      .set({
        paused: false,
        reason: null,
        actorWallet: req.walletAddr!,
        updatedAt: new Date(),
      })
      .where(eq(protocolState.id, existing.id))
      .returning();

    console.log(`[GUARDIAN] Protocol RESUMED by ${req.walletAddr}`);

    res.json({
      ok: true,
      paused: false,
      resumedAt: protocolRecord.updatedAt,
      resumedBy: protocolRecord.actorWallet,
      previousPauseReason: existing.reason,
      previousPausedBy: existing.actorWallet,
      message: 'Protocol has been resumed. All endpoints are now operational.',
    });
  } catch (error) {
    console.error('[GUARDIAN] Error resuming protocol:', error);
    res.status(500).json({ error: 'Failed to resume protocol' });
  }
});

router.get('/status', async (req: Request, res: Response) => {
  try {
    const [state] = await db
      .select()
      .from(protocolState)
      .orderBy(desc(protocolState.updatedAt))
      .limit(1);

    if (!state) {
      return res.json({
        paused: false,
        message: 'Protocol is operational (no state record)',
      });
    }

    res.json({
      paused: state.paused,
      ...(state.paused && {
        pausedAt: state.updatedAt,
        pausedBy: state.actorWallet,
        reason: state.reason,
      }),
      message: state.paused 
        ? 'Protocol is currently paused for maintenance or emergency' 
        : 'Protocol is operational',
    });
  } catch (error) {
    console.error('[GUARDIAN] Error fetching protocol status:', error);
    res.status(500).json({ error: 'Failed to fetch protocol status' });
  }
});

const timelockSchema = z.object({
  action: z.string().min(1).max(128),
  executeAfterSec: z.number().int().positive().max(604800),
});

router.post('/timelock', requireGuardianOrAdmin, async (req: GuardianRequest, res: Response) => {
  const result = timelockSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { action, executeAfterSec } = result.data;

  try {
    const [timelock] = await db
      .insert(guardianTimelocks)
      .values({
        action,
        executeAfterSec,
        executed: false,
      })
      .returning();

    const executeAt = new Date(Date.now() + executeAfterSec * 1000);

    console.log(`[GUARDIAN] Timelock created by ${req.walletAddr} - Action: ${action}, Execute after: ${executeAfterSec}s`);

    res.status(201).json({
      ok: true,
      timelockId: timelock.id,
      action: timelock.action,
      executeAfterSec: timelock.executeAfterSec,
      executeAt: executeAt.toISOString(),
      createdAt: timelock.createdAt,
      createdBy: req.walletAddr,
      message: `Timelock created. Action "${action}" will be available for execution after ${executeAfterSec} seconds.`,
    });
  } catch (error) {
    console.error('[GUARDIAN] Error creating timelock:', error);
    res.status(500).json({ error: 'Failed to create timelock' });
  }
});

router.get('/timelocks', requireGuardianOrAdmin, async (req: GuardianRequest, res: Response) => {
  try {
    const allTimelocks = await db
      .select()
      .from(guardianTimelocks)
      .orderBy(desc(guardianTimelocks.createdAt))
      .limit(100);

    res.json({
      ok: true,
      count: allTimelocks.length,
      timelocks: allTimelocks.map((tl) => ({
        id: tl.id,
        action: tl.action,
        executeAfterSec: tl.executeAfterSec,
        createdAt: tl.createdAt,
        executed: tl.executed,
        executeAt: tl.createdAt 
          ? new Date(new Date(tl.createdAt).getTime() + tl.executeAfterSec * 1000).toISOString()
          : null,
      })),
    });
  } catch (error) {
    console.error('[GUARDIAN] Error fetching timelocks:', error);
    res.status(500).json({ error: 'Failed to fetch timelocks' });
  }
});

export default router;
