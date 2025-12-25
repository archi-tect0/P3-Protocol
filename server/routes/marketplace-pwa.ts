import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { db } from '../db';
import {
  pwaApps,
  pwaVersions,
  pwaInstalls,
  pwaSources,
  pwaSignatures,
  pwaAudits,
  insertPwaAppSchema,
  insertPwaVersionSchema,
  insertPwaInstallSchema,
  insertPwaSourceSchema,
  insertPwaSignatureSchema,
  insertPwaAuditSchema,
} from '@shared/schema';
import { eq, and, ilike, or, sql, inArray } from 'drizzle-orm';

export const pwaRouter = Router();

interface PwaManifest {
  name?: string;
  short_name?: string;
  icons?: Array<{ src: string; sizes?: string; type?: string }>;
  start_url?: string;
  scope?: string;
  display?: string;
  background_color?: string;
  theme_color?: string;
  description?: string;
}

interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  manifest?: PwaManifest;
}

function computeSha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = [];
  
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a valid JSON object'] };
  }
  
  const m = manifest as PwaManifest;
  
  if (!m.name && !m.short_name) {
    errors.push('Manifest must have either "name" or "short_name"');
  }
  
  if (!m.icons || !Array.isArray(m.icons) || m.icons.length === 0) {
    errors.push('Manifest must have at least one icon');
  } else {
    const has192 = m.icons.some(i => i.sizes?.includes('192'));
    const has512 = m.icons.some(i => i.sizes?.includes('512'));
    if (!has192 && !has512) {
      errors.push('Manifest should include 192x192 or 512x512 icon');
    }
  }
  
  if (!m.start_url) {
    errors.push('Manifest must have "start_url"');
  }
  
  if (!m.scope) {
    errors.push('Manifest must have "scope"');
  }
  
  const validDisplayModes = ['standalone', 'fullscreen', 'minimal-ui', 'browser'];
  if (!m.display || !validDisplayModes.includes(m.display)) {
    errors.push(`Manifest must have valid "display" mode: ${validDisplayModes.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    manifest: m,
  };
}

async function fetchManifest(url: string): Promise<{ manifest: PwaManifest | null; error?: string; raw?: string }> {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/manifest+json, application/json' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return { manifest: null, error: `HTTP ${response.status}: ${response.statusText}` };
    }
    
    const raw = await response.text();
    const manifest = JSON.parse(raw);
    return { manifest, raw };
  } catch (err: any) {
    return { manifest: null, error: err.message || 'Failed to fetch manifest' };
  }
}

const catalogQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

pwaRouter.get('/catalog', async (req: Request, res: Response) => {
  try {
    const query = catalogQuerySchema.parse(req.query);
    
    let whereConditions: any[] = [];
    
    if (query.search) {
      whereConditions.push(
        or(
          ilike(pwaApps.name, `%${query.search}%`),
          ilike(pwaApps.description, `%${query.search}%`)
        )
      );
    }
    
    if (query.category) {
      whereConditions.push(
        sql`${query.category} = ANY(${pwaApps.categories})`
      );
    }
    
    const apps = await db
      .select({
        id: pwaApps.id,
        slug: pwaApps.slug,
        name: pwaApps.name,
        description: pwaApps.description,
        iconUrl: pwaApps.iconUrl,
        categories: pwaApps.categories,
        homepage: pwaApps.homepage,
        createdAt: pwaApps.createdAt,
      })
      .from(pwaApps)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .limit(query.limit)
      .offset(query.offset);
    
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pwaApps)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
    
    res.json({
      items: apps,
      total: Number(countResult?.count || 0),
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    console.error('[PWA] Catalog error:', error);
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

pwaRouter.get('/apps/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const [app] = await db
      .select()
      .from(pwaApps)
      .where(eq(pwaApps.slug, slug))
      .limit(1);
    
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    const versions = await db
      .select()
      .from(pwaVersions)
      .where(eq(pwaVersions.appId, app.id))
      .orderBy(sql`${pwaVersions.createdAt} DESC`)
      .limit(10);
    
    const signatures = versions.length > 0
      ? await db
          .select()
          .from(pwaSignatures)
          .where(inArray(pwaSignatures.versionId, versions.map(v => v.id)))
      : [];
    
    res.json({
      app,
      versions: versions.map(v => ({
        ...v,
        signatures: signatures.filter(s => s.versionId === v.id),
      })),
    });
  } catch (error) {
    console.error('[PWA] App detail error:', error);
    res.status(500).json({ error: 'Failed to fetch app details' });
  }
});

const installSchema = z.object({
  container: z.string().optional(),
  targetFolder: z.string().optional(),
  networkProfile: z.enum(['offline', 'online', 'hybrid']).default('online'),
});

pwaRouter.post('/apps/:slug/install', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet address required' });
    }
    
    const { slug } = req.params;
    const body = installSchema.parse(req.body);
    
    const [app] = await db
      .select()
      .from(pwaApps)
      .where(eq(pwaApps.slug, slug))
      .limit(1);
    
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    if (!app.latestVersionId) {
      return res.status(400).json({ error: 'App has no available version' });
    }
    
    const [existingInstall] = await db
      .select()
      .from(pwaInstalls)
      .where(
        and(
          eq(pwaInstalls.walletAddress, wallet.toLowerCase()),
          eq(pwaInstalls.appId, app.id)
        )
      )
      .limit(1);
    
    if (existingInstall) {
      if (existingInstall.versionId === app.latestVersionId && existingInstall.status === 'installed') {
        return res.json({
          install: existingInstall,
          message: 'Already installed with latest version',
          idempotent: true,
        });
      }
      
      const [updated] = await db
        .update(pwaInstalls)
        .set({
          versionId: app.latestVersionId,
          status: 'installed',
          container: body.container,
          targetFolder: body.targetFolder,
          networkProfile: body.networkProfile,
          updatedAt: new Date(),
        })
        .where(eq(pwaInstalls.id, existingInstall.id))
        .returning();
      
      await db.insert(pwaAudits).values({
        topic: 'update',
        refId: updated.id,
        walletAddress: wallet.toLowerCase(),
        meta: { previousVersionId: existingInstall.versionId, newVersionId: app.latestVersionId },
      });
      
      return res.json({ install: updated, message: 'Updated to latest version' });
    }
    
    const [install] = await db.insert(pwaInstalls).values({
      walletAddress: wallet.toLowerCase(),
      appId: app.id,
      versionId: app.latestVersionId,
      status: 'installed',
      container: body.container,
      targetFolder: body.targetFolder,
      networkProfile: body.networkProfile,
    }).returning();
    
    await db.insert(pwaAudits).values({
      topic: 'install',
      refId: install.id,
      walletAddress: wallet.toLowerCase(),
      meta: { appSlug: slug, versionId: app.latestVersionId },
    });
    
    res.json({ install, message: 'App installed successfully' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('[PWA] Install error:', error);
    res.status(500).json({ error: 'Failed to install app' });
  }
});

pwaRouter.post('/apps/:slug/rollback', async (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] || req.headers['x-wallet'];
    if (!wallet || typeof wallet !== 'string') {
      return res.status(401).json({ error: 'Wallet address required' });
    }
    
    const { slug } = req.params;
    
    const [app] = await db
      .select()
      .from(pwaApps)
      .where(eq(pwaApps.slug, slug))
      .limit(1);
    
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    const [existingInstall] = await db
      .select()
      .from(pwaInstalls)
      .where(
        and(
          eq(pwaInstalls.walletAddress, wallet.toLowerCase()),
          eq(pwaInstalls.appId, app.id)
        )
      )
      .limit(1);
    
    if (!existingInstall) {
      return res.status(404).json({ error: 'App not installed' });
    }
    
    const versions = await db
      .select()
      .from(pwaVersions)
      .where(eq(pwaVersions.appId, app.id))
      .orderBy(sql`${pwaVersions.createdAt} DESC`)
      .limit(2);
    
    if (versions.length < 2) {
      return res.status(400).json({ error: 'No previous version available for rollback' });
    }
    
    const previousVersion = versions[1];
    
    const [updated] = await db
      .update(pwaInstalls)
      .set({
        versionId: previousVersion.id,
        status: 'rolled_back',
        updatedAt: new Date(),
      })
      .where(eq(pwaInstalls.id, existingInstall.id))
      .returning();
    
    await db.insert(pwaAudits).values({
      topic: 'rollback',
      refId: updated.id,
      walletAddress: wallet.toLowerCase(),
      meta: { fromVersionId: existingInstall.versionId, toVersionId: previousVersion.id },
    });
    
    res.json({ install: updated, message: 'Rolled back to previous version' });
  } catch (error) {
    console.error('[PWA] Rollback error:', error);
    res.status(500).json({ error: 'Failed to rollback app' });
  }
});

pwaRouter.post('/aggregator/run', async (req: Request, res: Response) => {
  try {
    const sources = await db
      .select()
      .from(pwaSources)
      .where(eq(pwaSources.enabled, true));
    
    if (sources.length === 0) {
      return res.json({ message: 'No enabled sources', processed: 0 });
    }
    
    const results: Array<{ sourceId: string; sourceName: string; appsProcessed: number; errors: string[] }> = [];
    
    for (const source of sources) {
      const sourceResult = { sourceId: source.id, sourceName: source.name, appsProcessed: 0, errors: [] as string[] };
      
      try {
        const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) {
          sourceResult.errors.push(`Failed to fetch source: HTTP ${response.status}`);
          results.push(sourceResult);
          continue;
        }
        
        const sourceData = await response.json();
        const apps = Array.isArray(sourceData) ? sourceData : sourceData.apps || [];
        
        for (const appData of apps) {
          try {
            if (!appData.manifestUrl) {
              sourceResult.errors.push(`App missing manifestUrl: ${appData.name || 'unknown'}`);
              continue;
            }
            
            const { manifest, error, raw } = await fetchManifest(appData.manifestUrl);
            
            if (error || !manifest || !raw) {
              sourceResult.errors.push(`Failed to fetch manifest for ${appData.name || appData.slug}: ${error}`);
              continue;
            }
            
            const validation = validateManifest(manifest);
            if (!validation.valid) {
              sourceResult.errors.push(`Invalid manifest for ${appData.name || appData.slug}: ${validation.errors.join(', ')}`);
              continue;
            }
            
            const manifestHash = computeSha256(raw);
            const slug = appData.slug || (manifest.name || manifest.short_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            
            if (!slug) {
              sourceResult.errors.push('Could not generate slug for app');
              continue;
            }
            
            const [existingApp] = await db
              .select()
              .from(pwaApps)
              .where(eq(pwaApps.slug, slug))
              .limit(1);
            
            let appId: string;
            
            if (existingApp) {
              appId = existingApp.id;
              
              await db
                .update(pwaApps)
                .set({
                  name: manifest.name || manifest.short_name || existingApp.name,
                  description: manifest.description || appData.description,
                  iconUrl: manifest.icons?.[0]?.src || appData.iconUrl,
                  categories: appData.categories || existingApp.categories,
                  homepage: appData.homepage || existingApp.homepage,
                  updatedAt: new Date(),
                })
                .where(eq(pwaApps.id, appId));
            } else {
              const [newApp] = await db.insert(pwaApps).values({
                slug,
                name: manifest.name || manifest.short_name || slug,
                description: manifest.description || appData.description,
                iconUrl: manifest.icons?.[0]?.src || appData.iconUrl,
                categories: appData.categories || [],
                homepage: appData.homepage,
                sourceId: source.id,
              }).returning();
              
              appId = newApp.id;
            }
            
            const [existingVersion] = await db
              .select()
              .from(pwaVersions)
              .where(
                and(
                  eq(pwaVersions.appId, appId),
                  eq(pwaVersions.manifestHash, manifestHash)
                )
              )
              .limit(1);
            
            if (!existingVersion) {
              const [newVersion] = await db.insert(pwaVersions).values({
                appId,
                manifestUrl: appData.manifestUrl,
                manifestHash,
                bundleUrl: appData.bundleUrl,
                bundleHash: appData.bundleHash,
                display: (manifest.display as any) || 'standalone',
                scope: manifest.scope,
                startUrl: manifest.start_url!,
                offlineReady: appData.offlineReady || false,
                lighthouse: appData.lighthouse,
                signed: false,
              }).returning();
              
              await db
                .update(pwaApps)
                .set({ latestVersionId: newVersion.id, updatedAt: new Date() })
                .where(eq(pwaApps.id, appId));
            }
            
            sourceResult.appsProcessed++;
          } catch (appError: any) {
            sourceResult.errors.push(`Error processing app: ${appError.message}`);
          }
        }
      } catch (sourceError: any) {
        sourceResult.errors.push(`Source error: ${sourceError.message}`);
      }
      
      results.push(sourceResult);
    }
    
    const totalProcessed = results.reduce((sum, r) => sum + r.appsProcessed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    
    res.json({
      message: 'Aggregator run complete',
      processed: totalProcessed,
      errors: totalErrors,
      results,
    });
  } catch (error) {
    console.error('[PWA] Aggregator error:', error);
    res.status(500).json({ error: 'Failed to run aggregator' });
  }
});

pwaRouter.post('/sources', async (req: Request, res: Response) => {
  try {
    const body = insertPwaSourceSchema.parse(req.body);
    
    const [source] = await db.insert(pwaSources).values(body).returning();
    
    res.json({ source, message: 'Source added successfully' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('[PWA] Add source error:', error);
    res.status(500).json({ error: 'Failed to add source' });
  }
});

pwaRouter.get('/sources', async (req: Request, res: Response) => {
  try {
    const sources = await db.select().from(pwaSources);
    res.json({ sources });
  } catch (error) {
    console.error('[PWA] List sources error:', error);
    res.status(500).json({ error: 'Failed to list sources' });
  }
});

pwaRouter.post('/validate-manifest', async (req: Request, res: Response) => {
  try {
    const { url, manifest } = req.body;
    
    if (url) {
      const { manifest: fetchedManifest, error, raw } = await fetchManifest(url);
      if (error || !fetchedManifest) {
        return res.status(400).json({ valid: false, errors: [error || 'Failed to fetch manifest'] });
      }
      
      const validation = validateManifest(fetchedManifest);
      return res.json({
        ...validation,
        hash: raw ? computeSha256(raw) : null,
      });
    }
    
    if (manifest) {
      const validation = validateManifest(manifest);
      return res.json({
        ...validation,
        hash: computeSha256(JSON.stringify(manifest)),
      });
    }
    
    res.status(400).json({ error: 'Provide either "url" or "manifest"' });
  } catch (error) {
    console.error('[PWA] Validate manifest error:', error);
    res.status(500).json({ error: 'Failed to validate manifest' });
  }
});

pwaRouter.post('/verify-hash', async (req: Request, res: Response) => {
  try {
    const { data, expectedHash } = req.body;
    
    if (!data || !expectedHash) {
      return res.status(400).json({ error: 'Provide "data" and "expectedHash"' });
    }
    
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const computedHash = computeSha256(dataStr);
    const matches = computedHash === expectedHash;
    
    res.json({ matches, computedHash, expectedHash });
  } catch (error) {
    console.error('[PWA] Verify hash error:', error);
    res.status(500).json({ error: 'Failed to verify hash' });
  }
});

export default pwaRouter;
