import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { apiUsage, apiKeys, anomalies } from '@shared/schema';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { startOfMonth, endOfMonth, subDays } from 'date-fns';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { trackUsage } from '../services/usage-tracker';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

interface AnalyticsRequest extends Request {
  walletAddr?: string;
  isAdmin?: boolean;
}

function extractWallet(req: AnalyticsRequest, res: Response, next: Function): void {
  const addr = req.headers['x-p3-addr'] as string | undefined;
  if (addr) {
    req.walletAddr = addr.toLowerCase();
    req.isAdmin = ADMIN_WALLET ? req.walletAddr === ADMIN_WALLET : false;
  }
  next();
}

router.get(
  '/traffic',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  async (req: AnalyticsRequest, res: Response) => {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const startDate = subDays(new Date(), days);

    try {
      const trafficData = await db
        .select({
          endpoint: apiUsage.endpoint,
          totalHits: sql<number>`SUM(${apiUsage.count})::int`,
          uniqueKeys: sql<number>`COUNT(DISTINCT ${apiUsage.keyId})::int`,
          lastActivity: sql<Date>`MAX(${apiUsage.lastHitAt})`,
        })
        .from(apiUsage)
        .where(gte(apiUsage.lastHitAt, startDate))
        .groupBy(apiUsage.endpoint)
        .orderBy(desc(sql`SUM(${apiUsage.count})`));

      const totalRequests = trafficData.reduce((sum, row) => sum + (row.totalHits || 0), 0);

      res.json({
        period: {
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
          days,
        },
        summary: {
          totalRequests,
          uniqueEndpoints: trafficData.length,
        },
        traffic: trafficData.map(row => ({
          endpoint: row.endpoint,
          hits: row.totalHits,
          uniqueApiKeys: row.uniqueKeys,
          lastActivity: row.lastActivity,
        })),
      });
    } catch (error) {
      console.error('[ANALYTICS] Error fetching traffic data:', error);
      res.status(500).json({ error: 'Failed to fetch traffic data' });
    }
  }
);

router.get(
  '/endpoints',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  async (req: AnalyticsRequest, res: Response) => {
    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);

    try {
      const endpointStats = await db
        .select({
          endpoint: apiUsage.endpoint,
          totalCount: sql<number>`SUM(${apiUsage.count})::int`,
          avgCount: sql<number>`AVG(${apiUsage.count})::float`,
          maxCount: sql<number>`MAX(${apiUsage.count})::int`,
          minCount: sql<number>`MIN(${apiUsage.count})::int`,
          keyCount: sql<number>`COUNT(DISTINCT ${apiUsage.keyId})::int`,
          firstHit: sql<Date>`MIN(${apiUsage.periodStart})`,
          lastHit: sql<Date>`MAX(${apiUsage.lastHitAt})`,
        })
        .from(apiUsage)
        .where(
          and(
            gte(apiUsage.periodStart, periodStart),
            lte(apiUsage.periodEnd, periodEnd)
          )
        )
        .groupBy(apiUsage.endpoint)
        .orderBy(desc(sql`SUM(${apiUsage.count})`));

      res.json({
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        endpoints: endpointStats.map(stat => ({
          endpoint: stat.endpoint,
          stats: {
            total: stat.totalCount,
            average: Math.round((stat.avgCount || 0) * 100) / 100,
            max: stat.maxCount,
            min: stat.minCount,
          },
          uniqueApiKeys: stat.keyCount,
          firstHit: stat.firstHit,
          lastHit: stat.lastHit,
        })),
        totalEndpoints: endpointStats.length,
      });
    } catch (error) {
      console.error('[ANALYTICS] Error fetching endpoint stats:', error);
      res.status(500).json({ error: 'Failed to fetch endpoint statistics' });
    }
  }
);

router.get(
  '/tenants',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  async (req: AnalyticsRequest, res: Response) => {
    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    try {
      const tenantUsage = await db
        .select({
          tenantId: apiKeys.tenantId,
          keyCount: sql<number>`COUNT(DISTINCT ${apiKeys.id})::int`,
          totalUsage: sql<number>`COALESCE(SUM(${apiUsage.count}), 0)::int`,
          quotaSum: sql<number>`SUM(${apiKeys.quotaMonthly})::int`,
          activeKeys: sql<number>`COUNT(DISTINCT CASE WHEN ${apiKeys.status} = 'active' THEN ${apiKeys.id} END)::int`,
          revokedKeys: sql<number>`COUNT(DISTINCT CASE WHEN ${apiKeys.status} = 'revoked' THEN ${apiKeys.id} END)::int`,
        })
        .from(apiKeys)
        .leftJoin(
          apiUsage,
          and(
            eq(apiUsage.keyId, apiKeys.id),
            gte(apiUsage.periodStart, periodStart),
            lte(apiUsage.periodEnd, periodEnd)
          )
        )
        .groupBy(apiKeys.tenantId)
        .orderBy(desc(sql`COALESCE(SUM(${apiUsage.count}), 0)`))
        .limit(limit);

      const totalTenants = tenantUsage.length;
      const totalUsage = tenantUsage.reduce((sum, t) => sum + (t.totalUsage || 0), 0);

      res.json({
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        summary: {
          totalTenants,
          totalUsage,
        },
        tenants: tenantUsage.map(tenant => ({
          tenantId: tenant.tenantId,
          usage: {
            total: tenant.totalUsage,
            quota: tenant.quotaSum,
            percentUsed: tenant.quotaSum > 0 
              ? Math.round((tenant.totalUsage / tenant.quotaSum) * 10000) / 100 
              : 0,
          },
          keys: {
            total: tenant.keyCount,
            active: tenant.activeKeys,
            revoked: tenant.revokedKeys,
          },
        })),
      });
    } catch (error) {
      console.error('[ANALYTICS] Error fetching tenant usage:', error);
      res.status(500).json({ error: 'Failed to fetch tenant usage' });
    }
  }
);

const anomalyScoreSchema = z.object({
  tenantId: z.string().min(1).max(64),
  features: z.record(z.unknown()),
  threshold: z.number().min(0).max(1).optional(),
});

router.post(
  '/anomaly/score',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  async (req: AnalyticsRequest, res: Response) => {
    const result = anomalyScoreSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { tenantId, features, threshold = 0.7 } = result.data;

    try {
      const featureValues = Object.values(features).filter(v => typeof v === 'number') as number[];
      
      let anomalyScore = 0;
      if (featureValues.length > 0) {
        const mean = featureValues.reduce((a, b) => a + b, 0) / featureValues.length;
        const variance = featureValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / featureValues.length;
        const stdDev = Math.sqrt(variance);
        
        const normalizedScore = stdDev > 0 ? Math.min(1, stdDev / 100) : 0;
        const requestRateScore = (features.requestRate as number || 0) > 1000 ? 0.3 : 0;
        const errorRateScore = (features.errorRate as number || 0) > 0.1 ? 0.2 : 0;
        const unusualPatternScore = (features.unusualPatterns as number || 0) * 0.1;
        
        anomalyScore = Math.min(0.999, normalizedScore + requestRateScore + errorRateScore + unusualPatternScore);
      }

      const scoreString = anomalyScore.toFixed(3);
      const isAnomaly = anomalyScore >= threshold;

      const [anomalyRecord] = await db
        .insert(anomalies)
        .values({
          tenantId,
          score: scoreString,
          features,
        })
        .returning();

      console.log(`[ANALYTICS] Anomaly scored for ${tenantId}: ${scoreString} (threshold: ${threshold}, isAnomaly: ${isAnomaly})`);

      res.status(201).json({
        ok: true,
        anomalyId: anomalyRecord.id,
        tenantId: anomalyRecord.tenantId,
        score: parseFloat(scoreString),
        threshold,
        isAnomaly,
        features: anomalyRecord.features,
        createdAt: anomalyRecord.createdAt,
        recommendation: isAnomaly 
          ? 'Investigate unusual activity patterns for this tenant'
          : 'Activity patterns appear normal',
      });
    } catch (error) {
      console.error('[ANALYTICS] Error scoring anomaly:', error);
      res.status(500).json({ error: 'Failed to score anomaly' });
    }
  }
);

router.get(
  '/anomaly/recent',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  async (req: AnalyticsRequest, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const tenantId = req.query.tenantId as string | undefined;
    const minScore = parseFloat(req.query.minScore as string) || 0;

    try {
      let query = db
        .select()
        .from(anomalies)
        .orderBy(desc(anomalies.createdAt))
        .limit(limit);

      let recentAnomalies;

      if (tenantId) {
        recentAnomalies = await db
          .select()
          .from(anomalies)
          .where(
            and(
              eq(anomalies.tenantId, tenantId),
              sql`${anomalies.score}::float >= ${minScore}`
            )
          )
          .orderBy(desc(anomalies.createdAt))
          .limit(limit);
      } else if (minScore > 0) {
        recentAnomalies = await db
          .select()
          .from(anomalies)
          .where(sql`${anomalies.score}::float >= ${minScore}`)
          .orderBy(desc(anomalies.createdAt))
          .limit(limit);
      } else {
        recentAnomalies = await db
          .select()
          .from(anomalies)
          .orderBy(desc(anomalies.createdAt))
          .limit(limit);
      }

      const highRiskCount = recentAnomalies.filter(a => parseFloat(a.score) >= 0.7).length;
      const mediumRiskCount = recentAnomalies.filter(a => parseFloat(a.score) >= 0.4 && parseFloat(a.score) < 0.7).length;
      const lowRiskCount = recentAnomalies.filter(a => parseFloat(a.score) < 0.4).length;

      res.json({
        filters: {
          tenantId: tenantId || 'all',
          minScore,
          limit,
        },
        summary: {
          total: recentAnomalies.length,
          highRisk: highRiskCount,
          mediumRisk: mediumRiskCount,
          lowRisk: lowRiskCount,
        },
        anomalies: recentAnomalies.map(a => ({
          id: a.id,
          tenantId: a.tenantId,
          score: parseFloat(a.score),
          riskLevel: parseFloat(a.score) >= 0.7 ? 'high' : parseFloat(a.score) >= 0.4 ? 'medium' : 'low',
          features: a.features,
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      console.error('[ANALYTICS] Error fetching recent anomalies:', error);
      res.status(500).json({ error: 'Failed to fetch recent anomalies' });
    }
  }
);

router.get(
  '/anomaly/tenant/:tenantId/summary',
  apiKeyAuth(true),
  trackUsage,
  async (req: Request, res: Response) => {
    const { tenantId } = req.params;
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const startDate = subDays(new Date(), days);

    try {
      const tenantAnomalies = await db
        .select()
        .from(anomalies)
        .where(
          and(
            eq(anomalies.tenantId, tenantId),
            gte(anomalies.createdAt, startDate)
          )
        )
        .orderBy(desc(anomalies.createdAt));

      if (tenantAnomalies.length === 0) {
        return res.json({
          tenantId,
          period: { days, startDate: startDate.toISOString() },
          summary: {
            totalAnomalies: 0,
            averageScore: 0,
            maxScore: 0,
            trend: 'stable',
          },
          anomalies: [],
        });
      }

      const scores = tenantAnomalies.map(a => parseFloat(a.score));
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const maxScore = Math.max(...scores);

      const recentScores = scores.slice(0, Math.min(5, scores.length));
      const olderScores = scores.slice(Math.min(5, scores.length));
      const recentAvg = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
      const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : recentAvg;
      const trend = recentAvg > olderAvg * 1.2 ? 'increasing' : recentAvg < olderAvg * 0.8 ? 'decreasing' : 'stable';

      res.json({
        tenantId,
        period: { days, startDate: startDate.toISOString() },
        summary: {
          totalAnomalies: tenantAnomalies.length,
          averageScore: Math.round(avgScore * 1000) / 1000,
          maxScore: Math.round(maxScore * 1000) / 1000,
          trend,
        },
        recentAnomalies: tenantAnomalies.slice(0, 10).map(a => ({
          id: a.id,
          score: parseFloat(a.score),
          features: a.features,
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      console.error('[ANALYTICS] Error fetching tenant anomaly summary:', error);
      res.status(500).json({ error: 'Failed to fetch tenant anomaly summary' });
    }
  }
);

export default router;
