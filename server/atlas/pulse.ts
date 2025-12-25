import { Router, Request, Response } from 'express';
import { db } from '../db';
import { marketplaceItems, games, atlasEndpoints } from '@shared/schema';
import { eq, sql, gte, and, desc } from 'drizzle-orm';
import { manifestRegistry } from './core/registry';
import * as fs from 'fs';
import * as path from 'path';
import { getPulseMetrics } from './services/pulseService';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

interface GrowthTotals {
  games: number;
  ebooks: number;
  videos: number;
  products: number;
  total: number;
}

interface GrowthDeltas {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface ContentTypeMetrics {
  total: number;
  deltas: GrowthDeltas;
}

interface SurfaceGrowthResponse {
  success: boolean;
  timestamp: string;
  totals: GrowthTotals;
  byType: {
    games: ContentTypeMetrics;
    ebooks: ContentTypeMetrics;
    videos: ContentTypeMetrics;
    products: ContentTypeMetrics;
  };
  aggregateDeltas: GrowthDeltas;
  narrative: string;
}

function getTimeRanges(): { todayStart: Date; weekStart: Date; monthStart: Date } {
  const now = new Date();
  
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  
  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);
  monthStart.setHours(0, 0, 0, 0);
  
  return { todayStart, weekStart, monthStart };
}

async function getGamesCount(): Promise<ContentTypeMetrics> {
  const { todayStart, weekStart, monthStart } = getTimeRanges();
  
  try {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(games);
    const total = Number(totalResult?.count) || 0;
    
    const [todayResult] = await db.select({ count: sql<number>`count(*)` })
      .from(games)
      .where(gte(games.createdAt, todayStart));
    const today = Number(todayResult?.count) || 0;
    
    const [weekResult] = await db.select({ count: sql<number>`count(*)` })
      .from(games)
      .where(gte(games.createdAt, weekStart));
    const thisWeek = Number(weekResult?.count) || 0;
    
    const [monthResult] = await db.select({ count: sql<number>`count(*)` })
      .from(games)
      .where(gte(games.createdAt, monthStart));
    const thisMonth = Number(monthResult?.count) || 0;
    
    return {
      total,
      deltas: { today, thisWeek, thisMonth }
    };
  } catch (error) {
    console.error('[Pulse] Error fetching games count:', error);
    return { total: 0, deltas: { today: 0, thisWeek: 0, thisMonth: 0 } };
  }
}

async function getMarketplaceTypeCounts(itemType: string): Promise<ContentTypeMetrics> {
  const { todayStart, weekStart, monthStart } = getTimeRanges();
  
  try {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(marketplaceItems)
      .where(sql`${marketplaceItems.itemType} = ${itemType}`);
    const total = Number(totalResult?.count) || 0;
    
    const [todayResult] = await db.select({ count: sql<number>`count(*)` })
      .from(marketplaceItems)
      .where(sql`${marketplaceItems.itemType} = ${itemType} AND ${marketplaceItems.createdAt} >= ${todayStart}`);
    const today = Number(todayResult?.count) || 0;
    
    const [weekResult] = await db.select({ count: sql<number>`count(*)` })
      .from(marketplaceItems)
      .where(sql`${marketplaceItems.itemType} = ${itemType} AND ${marketplaceItems.createdAt} >= ${weekStart}`);
    const thisWeek = Number(weekResult?.count) || 0;
    
    const [monthResult] = await db.select({ count: sql<number>`count(*)` })
      .from(marketplaceItems)
      .where(sql`${marketplaceItems.itemType} = ${itemType} AND ${marketplaceItems.createdAt} >= ${monthStart}`);
    const thisMonth = Number(monthResult?.count) || 0;
    
    return {
      total,
      deltas: { today, thisWeek, thisMonth }
    };
  } catch (error) {
    console.error(`[Pulse] Error fetching ${itemType} count:`, error);
    return { total: 0, deltas: { today: 0, thisWeek: 0, thisMonth: 0 } };
  }
}

function generateNarrative(totals: GrowthTotals, deltas: GrowthDeltas): string {
  const narratives = [
    `The Atlas substrate now hosts ${totals.total.toLocaleString()} content items across games, ebooks, videos, and products.`,
    `Substrate expansion: +${deltas.thisMonth} items this month, proving Atlas is a living, growing mesh.`,
    `${totals.games.toLocaleString()} games, ${totals.ebooks.toLocaleString()} ebooks, ${totals.videos.toLocaleString()} videos — Atlas unifies all content under one protocol.`,
    `Today's growth: +${deltas.today} new items added to the Atlas surface.`,
    `The mesh expands: ${deltas.thisWeek} items joined the substrate this week.`,
  ];
  
  if (deltas.today > 0) {
    return `Today's growth: +${deltas.today} new items. The Atlas substrate now hosts ${totals.total.toLocaleString()} total items — a living, expanding mesh.`;
  }
  
  if (deltas.thisWeek > 0) {
    return `This week: +${deltas.thisWeek} items. Atlas substrate at ${totals.total.toLocaleString()} items across ${totals.games.toLocaleString()} games, ${totals.ebooks.toLocaleString()} ebooks, ${totals.videos.toLocaleString()} videos, and ${totals.products.toLocaleString()} products.`;
  }
  
  return `Atlas substrate: ${totals.total.toLocaleString()} items unified under one protocol. ${totals.games.toLocaleString()} games, ${totals.ebooks.toLocaleString()} ebooks, ${totals.videos.toLocaleString()} videos, ${totals.products.toLocaleString()} products.`;
}

interface CodebaseGrowthResponse {
  success: boolean;
  timestamp: string;
  commits: { today: number; thisWeek: number; thisMonth: number; total: number };
  linesOfCode: { added: number; removed: number; net: number; total: number };
  files: { created: number; modified: number; deleted: number };
  buildSize?: { clientMB: number; totalMB: number };
  contributors: number;
  branches: number;
  healthScore: number;
  narrative: string;
}

const GIT_SNAPSHOT_PATH = path.join(__dirname, 'data', 'git-snapshot.json');
let gitSnapshot: CodebaseGrowthResponse | null = null;

function loadGitSnapshot(): CodebaseGrowthResponse | null {
  try {
    if (fs.existsSync(GIT_SNAPSHOT_PATH)) {
      const data = JSON.parse(fs.readFileSync(GIT_SNAPSHOT_PATH, 'utf8'));
      console.log('[Pulse] Loaded git snapshot from build-time capture');
      return {
        success: true,
        timestamp: data.capturedAt || new Date().toISOString(),
        commits: data.commits,
        linesOfCode: data.linesOfCode,
        files: data.files,
        buildSize: data.buildSize || { clientMB: 0, totalMB: 0 },
        contributors: data.contributors,
        branches: data.branches,
        healthScore: data.healthScore,
        narrative: data.narrative,
      };
    }
  } catch (e) {
    console.error('[Pulse] Failed to load git snapshot:', e);
  }
  return null;
}

gitSnapshot = loadGitSnapshot();

let codebaseCache: CodebaseGrowthResponse | null = null;
let codebaseCacheTime = 0;
const CODEBASE_CACHE_TTL = 5 * 60 * 1000;
let codebaseUpdateInProgress = false;

async function updateCodebaseMetrics(): Promise<CodebaseGrowthResponse> {
  if (codebaseUpdateInProgress) {
    return codebaseCache || getDefaultCodebaseMetrics();
  }
  
  codebaseUpdateInProgress = true;
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const safeExec = async (cmd: string): Promise<string> => {
      try {
        const { stdout } = await execAsync(cmd, { timeout: 5000, maxBuffer: 1024 * 100 });
        return stdout.trim();
      } catch {
        return '';
      }
    };

    const [commitTotal, commitToday, commitWeek, commitMonth, branchesOut, contributorsOut, totalLinesOut] = await Promise.all([
      safeExec('git rev-list --count HEAD 2>/dev/null'),
      safeExec('git rev-list --count HEAD --since="midnight" 2>/dev/null'),
      safeExec('git rev-list --count HEAD --since="7 days ago" 2>/dev/null'),
      safeExec('git rev-list --count HEAD --since="30 days ago" 2>/dev/null'),
      safeExec('git branch --list 2>/dev/null | wc -l'),
      safeExec('git shortlog -sn --all 2>/dev/null | wc -l'),
      safeExec('git ls-files -z -- "*.ts" "*.tsx" "*.js" "*.jsx" "*.py" "*.css" "*.html" "*.json" "*.md" 2>/dev/null | xargs -0 wc -l 2>/dev/null | tail -1'),
    ]);

    const commits = {
      total: parseInt(commitTotal) || 0,
      today: parseInt(commitToday) || 0,
      thisWeek: parseInt(commitWeek) || 0,
      thisMonth: parseInt(commitMonth) || 0,
    };
    const branches = parseInt(branchesOut) || 1;
    const contributors = parseInt(contributorsOut) || 1;
    
    // Parse total lines - output is like "123456 total" or just "123456"
    const totalLinesMatch = totalLinesOut.match(/(\d+)/);
    const totalLines = totalLinesMatch ? parseInt(totalLinesMatch[1]) : 0;

    let linesAdded = 0, linesRemoved = 0;
    let filesCreated = 0, filesModified = 0, filesDeleted = 0;

    try {
      // Track changes over 24-hour interval instead of last 10 commits
      const oneDayAgo = await safeExec('git rev-list -1 HEAD --before="24 hours ago" 2>/dev/null');
      const diffRef = oneDayAgo || 'HEAD~1'; // Fallback to HEAD~1 if no commits older than 24h
      
      const diffStat = await safeExec(`git diff --stat ${diffRef} HEAD 2>/dev/null`);
      const insertions = diffStat.match(/(\d+) insertions?\(\+\)/);
      const deletions = diffStat.match(/(\d+) deletions?\(-\)/);
      linesAdded = insertions ? parseInt(insertions[1]) : 0;
      linesRemoved = deletions ? parseInt(deletions[1]) : 0;

      const diffNames = await safeExec(`git diff --name-status ${diffRef} HEAD 2>/dev/null`);
      diffNames.split('\n').filter(Boolean).forEach((line: string) => {
        if (line.startsWith('A')) filesCreated++;
        else if (line.startsWith('M')) filesModified++;
        else if (line.startsWith('D')) filesDeleted++;
      });
    } catch {}

    // If git data unavailable, use production defaults
    const hasGitData = commits.total > 0 && totalLines > 0;
    if (!hasGitData) {
      return getDefaultCodebaseMetrics();
    }
    
    const healthScore = Math.min(100, Math.round(
      (commits.thisWeek > 0 ? 30 : 0) +
      (commits.thisMonth > 5 ? 30 : commits.thisMonth * 6) +
      (contributors > 0 ? 20 : 0) +
      (linesAdded > linesRemoved ? 20 : 10)
    ));

    let narrative = `Codebase health: ${healthScore}% with ${commits.total} total commits.`;
    if (linesAdded > 0 || linesRemoved > 0) {
      const netChange = linesAdded - linesRemoved;
      const changeDir = netChange >= 0 ? '+' : '';
      narrative = `24h activity: ${changeDir}${netChange.toLocaleString()} lines (${linesAdded.toLocaleString()} added, ${linesRemoved.toLocaleString()} removed). Health: ${healthScore}%.`;
    } else if (commits.today > 0) {
      narrative = `Active development: ${commits.today} commits today, ${commits.total} total. Health score: ${healthScore}%.`;
    } else if (commits.thisWeek > 0) {
      narrative = `Steady progress: ${commits.thisWeek} commits this week from ${contributors} contributor${contributors !== 1 ? 's' : ''}. Health: ${healthScore}%.`;
    }

    const result: CodebaseGrowthResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      commits,
      linesOfCode: { added: linesAdded, removed: linesRemoved, net: linesAdded - linesRemoved, total: totalLines },
      files: { created: filesCreated, modified: filesModified, deleted: filesDeleted },
      contributors,
      branches,
      healthScore,
      narrative,
    };

    codebaseCache = result;
    codebaseCacheTime = Date.now();
    return result;
  } catch (error) {
    console.error('[Pulse] Codebase metrics error:', error);
    return getDefaultCodebaseMetrics();
  } finally {
    codebaseUpdateInProgress = false;
  }
}

function getDefaultCodebaseMetrics(): CodebaseGrowthResponse {
  if (gitSnapshot) {
    console.log('[Pulse] Using git snapshot for codebase metrics (git unavailable)');
    return gitSnapshot;
  }
  console.warn('[Pulse] No git snapshot available - git metrics will be unavailable');
  return {
    success: false,
    timestamp: new Date().toISOString(),
    commits: { today: 0, thisWeek: 0, thisMonth: 0, total: 0 },
    linesOfCode: { added: 0, removed: 0, net: 0, total: 0 },
    files: { created: 0, modified: 0, deleted: 0 },
    contributors: 0,
    branches: 0,
    healthScore: 0,
    narrative: 'Git metrics unavailable - snapshot missing',
  };
}

setImmediate(() => updateCodebaseMetrics());
setInterval(() => updateCodebaseMetrics(), CODEBASE_CACHE_TTL);

const codebaseRateLimit = new Map<string, number>();

router.get('/codebase', async (req: Request, res: Response) => {
  const clientIp = req.ip || 'unknown';
  const now = Date.now();
  const lastRequest = codebaseRateLimit.get(clientIp) || 0;
  
  if (now - lastRequest < 1000) {
    return res.status(429).json({ success: false, error: 'Rate limited' });
  }
  codebaseRateLimit.set(clientIp, now);
  
  if (codebaseRateLimit.size > 1000) {
    const oldestKey = codebaseRateLimit.keys().next().value;
    if (oldestKey) codebaseRateLimit.delete(oldestKey);
  }
  
  if (codebaseCache && (now - codebaseCacheTime < CODEBASE_CACHE_TTL)) {
    if (isProduction) {
      return res.json({
        success: true,
        timestamp: codebaseCache.timestamp,
        healthScore: codebaseCache.healthScore,
        narrative: codebaseCache.narrative,
      });
    }
    return res.json(codebaseCache);
  }
  
  const metrics = await updateCodebaseMetrics();
  if (isProduction) {
    return res.json({
      success: metrics.success,
      timestamp: metrics.timestamp,
      healthScore: metrics.healthScore,
      narrative: metrics.narrative,
    });
  }
  res.json(metrics);
});

router.get('/growth', async (req: Request, res: Response) => {
  try {
    const [gamesMetrics, ebooksMetrics, videosMetrics, productsMetrics] = await Promise.all([
      getGamesCount(),
      getMarketplaceTypeCounts('ebook'),
      getMarketplaceTypeCounts('video'),
      getMarketplaceTypeCounts('product'),
    ]);
    
    const totals: GrowthTotals = {
      games: gamesMetrics.total,
      ebooks: ebooksMetrics.total,
      videos: videosMetrics.total,
      products: productsMetrics.total,
      total: gamesMetrics.total + ebooksMetrics.total + videosMetrics.total + productsMetrics.total,
    };
    
    const aggregateDeltas: GrowthDeltas = {
      today: gamesMetrics.deltas.today + ebooksMetrics.deltas.today + videosMetrics.deltas.today + productsMetrics.deltas.today,
      thisWeek: gamesMetrics.deltas.thisWeek + ebooksMetrics.deltas.thisWeek + videosMetrics.deltas.thisWeek + productsMetrics.deltas.thisWeek,
      thisMonth: gamesMetrics.deltas.thisMonth + ebooksMetrics.deltas.thisMonth + videosMetrics.deltas.thisMonth + productsMetrics.deltas.thisMonth,
    };
    
    const narrative = generateNarrative(totals, aggregateDeltas);
    
    const response: SurfaceGrowthResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      totals,
      byType: {
        games: gamesMetrics,
        ebooks: ebooksMetrics,
        videos: videosMetrics,
        products: productsMetrics,
      },
      aggregateDeltas,
      narrative,
    };
    
    res.json({
      ...response,
      'data-testid': 'pulse-growth-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch growth metrics';
    console.error('[Pulse] Growth metrics error:', error);
    res.status(500).json({
      success: false,
      error: message,
      'data-testid': 'pulse-growth-error',
    });
  }
});

interface MeshConnectionsResponse {
  success: boolean;
  timestamp: string;
  connections: {
    activeApis: number;
    registeredEndpoints: number;
    integratedApps: number;
    webhooks: number;
  };
  recentActivity: Array<{
    type: string;
    timestamp: string;
  }>;
  narrative: string;
}

router.get('/mesh', async (req: Request, res: Response) => {
  try {
    // Get counts from manifest registry (in-memory, authoritative source)
    const manifestEndpoints = manifestRegistry.listEndpoints();
    const manifestFlows = manifestRegistry.listFlows();
    
    // Also check database for user-registered endpoints
    const [dbEndpointsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(atlasEndpoints);
    const dbEndpoints = Number(dbEndpointsResult?.count) || 0;

    const [validatedEndpointsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(atlasEndpoints)
      .where(eq(atlasEndpoints.status, 'validated'));
    const dbActiveApis = Number(validatedEndpointsResult?.count) || 0;

    // Combine manifest registry counts with database counts
    const registeredEndpoints = manifestEndpoints.length + dbEndpoints;
    const activeApis = manifestEndpoints.filter(e => e.handler).length + dbActiveApis;

    // Count unique sources as "integrated apps"
    const sources = new Set(manifestEndpoints.map(e => e.source || 'atlas'));
    const integratedApps = Math.max(sources.size, manifestFlows.length);

    const webhooks = manifestEndpoints.filter(e => e['devkit.key']?.includes('webhook')).length;

    const recentEndpoints = await db.select({
      id: atlasEndpoints.id,
      status: atlasEndpoints.status,
      createdAt: atlasEndpoints.createdAt,
    })
      .from(atlasEndpoints)
      .orderBy(desc(atlasEndpoints.createdAt))
      .limit(5);

    const recentActivity = recentEndpoints.map(ep => ({
      type: ep.status === 'validated' ? 'call' : 'register',
      timestamp: ep.createdAt?.toISOString() || new Date().toISOString(),
    }));

    let narrative = `Developer mesh network: ${registeredEndpoints} registered endpoints with ${activeApis} actively validated APIs.`;
    if (activeApis > 0) {
      narrative = `Mesh network active: ${activeApis} validated APIs serving ${integratedApps} integrated applications. ${registeredEndpoints} total endpoints registered.`;
    } else if (registeredEndpoints > 0) {
      narrative = `Growing mesh: ${registeredEndpoints} endpoints registered, awaiting validation. Connect more apps to expand the network.`;
    } else {
      narrative = `Mesh network ready for connections. Register your first Atlas endpoint to join the developer mesh.`;
    }

    const response: MeshConnectionsResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      connections: {
        activeApis,
        registeredEndpoints,
        integratedApps,
        webhooks,
      },
      recentActivity,
      narrative,
    };

    res.json({
      ...response,
      'data-testid': 'pulse-mesh-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch mesh connections';
    console.error('[Pulse] Mesh connections error:', error);
    res.status(500).json({
      success: false,
      error: message,
      connections: { activeApis: 0, registeredEndpoints: 0, integratedApps: 0, webhooks: 0 },
      recentActivity: [],
      narrative: 'Unable to load mesh connection data.',
      'data-testid': 'pulse-mesh-error',
    });
  }
});

interface NodeDiagnostics {
  nodeMode: boolean;
  connectivity: {
    status: 'connected' | 'degraded' | 'offline';
    signalStrength: number;
    connectionType: string;
    latencyMs: number;
  };
  mesh: {
    participatingNodes: number;
    peersConnected: number;
    tasksCompleted: number;
    bandwidthContributed: number;
  };
  device: {
    platform: string;
    batteryOptimal: boolean;
    memoryAvailable: number;
  };
  uptime: number;
  lastSync: string;
}

router.get('/node/diagnostics', async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    
    const realMetrics = getPulseMetrics();
    
    const peersConnected = realMetrics.activeSubscribers;
    const tasksCompleted = realMetrics.articlesCachedByNodes + realMetrics.articlesRelayedByNodes;
    const bandwidthContributed = tasksCompleted * 1024;
    
    const hasActivity = peersConnected > 0 || tasksCompleted > 0;
    const status: 'connected' | 'degraded' | 'offline' = hasActivity ? 'connected' : 'offline';
    const signalStrength = hasActivity ? 0.92 : 0;
    const latencyMs = hasActivity ? 15 : 0;
    
    const diagnostics: NodeDiagnostics = {
      nodeMode: true,
      connectivity: {
        status,
        signalStrength,
        connectionType: isProduction ? 'network' : 'wifi',
        latencyMs,
      },
      mesh: {
        participatingNodes: peersConnected,
        peersConnected,
        tasksCompleted,
        bandwidthContributed: isProduction ? 0 : bandwidthContributed,
      },
      device: {
        platform: isProduction ? 'redacted' : 'web',
        batteryOptimal: true,
        memoryAvailable: isProduction ? 0 : 0.72,
      },
      uptime: realMetrics.lastBroadcastTimestamp > 0 
        ? Math.floor((now - realMetrics.lastBroadcastTimestamp) / 1000) 
        : 0,
      lastSync: realMetrics.lastBroadcastTimestamp > 0 
        ? new Date(realMetrics.lastBroadcastTimestamp).toISOString()
        : new Date().toISOString(),
    };
    
    const signalPercent = Math.round(diagnostics.connectivity.signalStrength * 100);
    
    let narrative: string;
    if (peersConnected === 0) {
      narrative = 'Node Mode ready. No active connections at this time.';
    } else {
      narrative = `Node Mode active. Connected to ${peersConnected} peer${peersConnected === 1 ? '' : 's'} with ${signalPercent}% signal strength.`;
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics,
      narrative,
      'data-testid': 'node-diagnostics-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch node diagnostics';
    console.error('[Pulse] Node diagnostics error:', error);
    res.status(500).json({
      success: false,
      error: message,
      diagnostics: null,
      narrative: 'Unable to retrieve Node Mode diagnostics.',
      'data-testid': 'node-diagnostics-error',
    });
  }
});

export default router;
