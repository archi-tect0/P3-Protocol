import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { systemTasks, taskStatuses } from '@shared/schema';
import { eq, and, desc, sql, or, inArray } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'system-routes' });
const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

const DEFAULT_PAGE_LIMIT = 20;

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string || '').toLowerCase() || null;
}

function createReceipt(status: 'success' | 'error' | 'empty', extra?: Record<string, any>) {
  return {
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

const createTaskSchema = z.object({
  type: z.string().min(1).max(64),
  description: z.string().max(256).optional(),
  meta: z.record(z.any()).optional(),
});

const updateTaskSchema = z.object({
  status: z.enum(taskStatuses).optional(),
  progress: z.number().min(0).max(100).optional(),
  description: z.string().max(256).optional(),
  meta: z.record(z.any()).optional(),
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const dbStart = Date.now();
    let dbStatus = 'healthy';
    let dbLatencyMs = 0;
    
    try {
      await db.execute(sql`SELECT 1`);
      dbLatencyMs = Date.now() - dbStart;
    } catch (dbErr) {
      dbStatus = 'unhealthy';
      logger.error(`Database health check failed: ${(dbErr as Error).message}`);
    }

    const [activeResult] = await db.select({ count: sql<number>`count(*)` })
      .from(systemTasks)
      .where(inArray(systemTasks.status, ['queued', 'running']));
    
    const activeTaskCount = Number(activeResult?.count || 0);

    const memUsage = process.memoryUsage();

    const health = {
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      database: {
        status: dbStatus,
        latencyMs: isProduction ? undefined : dbLatencyMs,
      },
      server: isProduction ? {
        uptimeSeconds: Math.floor(process.uptime()),
      } : {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsage: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
        },
      },
      tasks: isProduction ? undefined : {
        activeCount: activeTaskCount,
      },
    };

    logger.info(`Health check completed: ${health.status}`);
    res.json({
      ...health,
      receipt: createReceipt('success'),
    });
  } catch (err: any) {
    logger.error(`Health check failed: ${err.message}`);
    res.status(500).json({
      status: 'error',
      error: isProduction ? 'Internal server error' : err.message,
      receipt: createReceipt('error'),
    });
  }
});

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT, 100);
    const statusFilter = req.query.status as string;

    let conditions = [eq(systemTasks.walletAddress, wallet)];

    if (statusFilter && taskStatuses.includes(statusFilter as any)) {
      conditions.push(eq(systemTasks.status, statusFilter as typeof taskStatuses[number]));
    }

    const tasks = await db.select().from(systemTasks)
      .where(and(...conditions))
      .orderBy(desc(systemTasks.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(systemTasks)
      .where(and(...conditions));
    const total = Number(countResult?.count || 0);

    logger.info(`Listed ${tasks.length} tasks for wallet ${wallet}${statusFilter ? ` (status: ${statusFilter})` : ''}`);
    res.json({
      tasks,
      pagination: { offset, limit, total },
      receipt: createReceipt(tasks.length ? 'success' : 'empty', { count: tasks.length }),
    });
  } catch (err: any) {
    logger.error(`Failed to list tasks: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const parsed = createTaskSchema.parse(req.body);

    const [task] = await db.insert(systemTasks).values({
      walletAddress: wallet,
      type: parsed.type,
      status: 'queued',
      description: parsed.description,
      meta: parsed.meta,
      progress: 0,
    }).returning();

    logger.info(`Created task ${task.id} for wallet ${wallet} (type: ${parsed.type})`);

    res.status(201).json({
      task,
      receipt: createReceipt('success', { taskId: task.id }),
    });
  } catch (err: any) {
    logger.error(`Failed to create task: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const taskId = req.params.id;
    const parsed = updateTaskSchema.parse(req.body);

    const [existing] = await db.select().from(systemTasks)
      .where(and(eq(systemTasks.id, taskId), eq(systemTasks.walletAddress, wallet)));

    if (!existing) {
      return res.status(404).json({ error: 'Task not found', receipt: createReceipt('error') });
    }

    const updateData: Record<string, any> = {};

    if (parsed.status !== undefined) {
      updateData.status = parsed.status;
      if (parsed.status === 'running' && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (['done', 'error', 'cancelled'].includes(parsed.status) && !existing.finishedAt) {
        updateData.finishedAt = new Date();
      }
    }

    if (parsed.progress !== undefined) {
      updateData.progress = parsed.progress;
    }

    if (parsed.description !== undefined) {
      updateData.description = parsed.description;
    }

    if (parsed.meta !== undefined) {
      updateData.meta = parsed.meta;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No updates provided', receipt: createReceipt('error') });
    }

    const [updated] = await db.update(systemTasks)
      .set(updateData)
      .where(eq(systemTasks.id, taskId))
      .returning();

    logger.info(`Updated task ${taskId} for wallet ${wallet}`, updateData);

    res.json({
      task: updated,
      receipt: createReceipt('success', { taskId }),
    });
  } catch (err: any) {
    logger.error(`Failed to update task: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.post('/tasks/:id/cancel', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const taskId = req.params.id;

    const [existing] = await db.select().from(systemTasks)
      .where(and(eq(systemTasks.id, taskId), eq(systemTasks.walletAddress, wallet)));

    if (!existing) {
      return res.status(404).json({ error: 'Task not found', receipt: createReceipt('error') });
    }

    if (['done', 'error', 'cancelled'].includes(existing.status)) {
      return res.status(400).json({
        error: `Task already in terminal state: ${existing.status}`,
        receipt: createReceipt('error'),
      });
    }

    const [cancelled] = await db.update(systemTasks)
      .set({
        status: 'cancelled',
        finishedAt: new Date(),
      })
      .where(eq(systemTasks.id, taskId))
      .returning();

    logger.info(`Cancelled task ${taskId} for wallet ${wallet}`);

    res.json({
      task: cancelled,
      receipt: createReceipt('success', { taskId }),
    });
  } catch (err: any) {
    logger.error(`Failed to cancel task: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

export default router;
