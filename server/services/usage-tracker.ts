import { Request, Response, NextFunction } from 'express';
import { startOfMonth, endOfMonth } from 'date-fns';
import { db } from '../db';
import { apiUsage, ApiKey } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function trackUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.ctx?.apiKey as ApiKey | undefined;

  if (!apiKey) {
    return next();
  }

  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  const now = new Date();
  const periodStart = startOfMonth(now);
  const periodEnd = endOfMonth(now);

  try {
    const [existingUsage] = await db
      .select()
      .from(apiUsage)
      .where(
        and(
          eq(apiUsage.keyId, apiKey.id),
          eq(apiUsage.endpoint, endpoint),
          eq(apiUsage.periodStart, periodStart),
          eq(apiUsage.periodEnd, periodEnd)
        )
      )
      .limit(1);

    if (existingUsage) {
      await db
        .update(apiUsage)
        .set({
          count: existingUsage.count + 1,
          lastHitAt: now,
        })
        .where(eq(apiUsage.id, existingUsage.id));
    } else {
      await db.insert(apiUsage).values({
        keyId: apiKey.id,
        endpoint,
        count: 1,
        periodStart,
        periodEnd,
        lastHitAt: now,
      });
    }

    const [totalUsageResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${apiUsage.count}), 0)::int`,
      })
      .from(apiUsage)
      .where(
        and(
          eq(apiUsage.keyId, apiKey.id),
          eq(apiUsage.periodStart, periodStart),
          eq(apiUsage.periodEnd, periodEnd)
        )
      );

    const totalUsage = totalUsageResult?.total ?? 0;
    const quotaMonthly = apiKey.quotaMonthly ?? 100000;

    if (totalUsage > quotaMonthly) {
      res.status(429).json({
        error: 'quota_exceeded',
        message: 'Monthly API quota exceeded. Please upgrade your plan or wait until next billing period.',
        usage: {
          current: totalUsage,
          limit: quotaMonthly,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[usage-tracker] Database error:', error);
    next();
  }
}
