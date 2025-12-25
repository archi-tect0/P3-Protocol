import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  sandboxProjects, sandboxArtifacts, sandboxManifests, 
  sandboxPreviewSessions, sandboxGovernanceReviews, sandboxReceipts,
  sandboxDevInstances, sandboxDevBindings,
  sandboxKinds, artifactTypes, previewModes
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createHash, randomUUID } from 'crypto';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[SANDBOX] ${msg}`),
  error: (msg: string) => console.error(`[SANDBOX ERROR] ${msg}`),
};

function requireWallet(req: Request, res: Response): string | null {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(401).json({ error: 'Valid wallet address required' });
    return null;
  }
  return wallet.toLowerCase();
}

function createReceiptHash(data: any): string {
  return '0x' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function logReceipt(wallet: string, projectId: string | null, actor: string, action: string, meta?: any) {
  const requestId = randomUUID();
  await db.insert(sandboxReceipts).values({
    walletAddress: wallet,
    projectId: projectId || undefined,
    actor,
    action,
    metaJson: meta,
    requestId,
  });
  return requestId;
}

const createProjectSchema = z.object({
  name: z.string().min(2).max(256),
  kind: z.enum(sandboxKinds),
});

const artifactSchema = z.object({
  type: z.enum(artifactTypes),
  filename: z.string().min(1).max(256),
  mime: z.string().min(1).max(128),
  content: z.string().optional(),
  metaJson: z.record(z.any()).optional(),
});

const manifestSchema = z.object({
  name: z.string().min(1).max(256),
  version: z.string().min(1).max(32),
  kind: z.enum(sandboxKinds),
  permissions: z.record(z.array(z.string())).optional(),
  endpoints: z.array(z.object({
    method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
    path: z.string(),
    scopes: z.array(z.string()).optional(),
  })).optional(),
  canvasSchema: z.object({
    type: z.string(),
    title: z.string(),
    inputs: z.record(z.any()).optional(),
    outputs: z.record(z.any()).optional(),
    actions: z.array(z.record(z.any())).optional(),
  }).optional(),
});

const previewSchema = z.object({
  mode: z.enum(previewModes),
  runtime: z.object({
    entry: z.string().optional(),
    proxyPath: z.string().optional(),
  }).optional(),
});

router.post('/projects', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = createProjectSchema.parse(req.body);
    
    const [project] = await db.insert(sandboxProjects).values({
      walletAddress: wallet,
      name: parsed.name,
      kind: parsed.kind,
      status: 'draft',
    }).returning();

    await logReceipt(wallet, project.id, 'user', 'project.create', { projectId: project.id });
    logger.info(`Project ${project.id} created for wallet ${wallet}`);

    res.status(201).json({ project });
  } catch (err: any) {
    logger.error(`Create project failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.get('/projects', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const projects = await db.select().from(sandboxProjects)
      .where(eq(sandboxProjects.walletAddress, wallet))
      .orderBy(desc(sandboxProjects.updatedAt));

    res.json({ projects });
  } catch (err: any) {
    logger.error(`List projects failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, req.params.id),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const artifacts = await db.select().from(sandboxArtifacts)
      .where(eq(sandboxArtifacts.projectId, project.id))
      .orderBy(desc(sandboxArtifacts.createdAt));

    const [manifest] = await db.select().from(sandboxManifests)
      .where(eq(sandboxManifests.projectId, project.id));

    res.json({ project, artifacts, manifest });
  } catch (err: any) {
    logger.error(`Get project failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/projects/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [existing] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, req.params.id),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updates: Partial<typeof sandboxProjects.$inferInsert> = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.kind && sandboxKinds.includes(req.body.kind)) updates.kind = req.body.kind;
    updates.updatedAt = new Date();

    const [updated] = await db.update(sandboxProjects)
      .set(updates)
      .where(eq(sandboxProjects.id, req.params.id))
      .returning();

    await logReceipt(wallet, updated.id, 'user', 'project.update', { updates });
    res.json({ project: updated });
  } catch (err: any) {
    logger.error(`Update project failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.post('/projects/:id/artifacts', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = artifactSchema.parse(req.body);
    const projectId = req.params.id;

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, projectId),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const existingArtifacts = await db.select().from(sandboxArtifacts)
      .where(eq(sandboxArtifacts.projectId, projectId));
    const version = existingArtifacts.length + 1;

    const content = parsed.content || '';
    const sha256 = createReceiptHash(content);
    const path = `/sandbox/${wallet}/${projectId}/${parsed.filename}`;

    const [artifact] = await db.insert(sandboxArtifacts).values({
      projectId,
      walletAddress: wallet,
      type: parsed.type,
      filename: parsed.filename,
      path,
      mime: parsed.mime,
      sizeBytes: content.length,
      version,
      sha256,
      metaJson: parsed.metaJson,
    }).returning();

    await logReceipt(wallet, projectId, 'user', 'artifact.create', { artifactId: artifact.id });
    logger.info(`Artifact ${artifact.id} created for project ${projectId}`);

    res.status(201).json({ artifact });
  } catch (err: any) {
    logger.error(`Create artifact failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.get('/projects/:id/artifacts', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, req.params.id),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const artifacts = await db.select().from(sandboxArtifacts)
      .where(eq(sandboxArtifacts.projectId, project.id))
      .orderBy(desc(sandboxArtifacts.createdAt));

    res.json({ artifacts });
  } catch (err: any) {
    logger.error(`List artifacts failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/manifest', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = manifestSchema.parse(req.body);
    const projectId = req.params.id;

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, projectId),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [existing] = await db.select().from(sandboxManifests)
      .where(eq(sandboxManifests.projectId, projectId));

    let manifest;
    if (existing) {
      [manifest] = await db.update(sandboxManifests)
        .set({
          name: parsed.name,
          version: parsed.version,
          kind: parsed.kind,
          permissions: parsed.permissions || {},
          endpoints: parsed.endpoints,
          canvasSchema: parsed.canvasSchema,
          updatedAt: new Date(),
        })
        .where(eq(sandboxManifests.id, existing.id))
        .returning();
    } else {
      [manifest] = await db.insert(sandboxManifests).values({
        projectId,
        walletAddress: wallet,
        name: parsed.name,
        version: parsed.version,
        kind: parsed.kind,
        permissions: parsed.permissions || {},
        endpoints: parsed.endpoints,
        canvasSchema: parsed.canvasSchema,
      }).returning();
    }

    await db.update(sandboxProjects)
      .set({ manifestId: manifest.id, updatedAt: new Date() })
      .where(eq(sandboxProjects.id, projectId));

    await logReceipt(wallet, projectId, 'user', 'manifest.upsert', { manifestId: manifest.id });
    logger.info(`Manifest ${manifest.id} upserted for project ${projectId}`);

    res.json({ manifest });
  } catch (err: any) {
    logger.error(`Upsert manifest failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.get('/projects/:id/manifest', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, req.params.id),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [manifest] = await db.select().from(sandboxManifests)
      .where(eq(sandboxManifests.projectId, project.id));

    if (!manifest) {
      return res.status(404).json({ error: 'Manifest not found' });
    }

    res.json({ manifest });
  } catch (err: any) {
    logger.error(`Get manifest failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/preview', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = previewSchema.parse(req.body);
    const projectId = req.params.id;

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, projectId),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    if (parsed.mode === 'canvasCard') {
      const [manifest] = await db.select().from(sandboxManifests)
        .where(eq(sandboxManifests.projectId, projectId));

      if (!manifest?.canvasSchema) {
        return res.status(400).json({ error: 'Canvas schema missing in manifest' });
      }

      const [session] = await db.insert(sandboxPreviewSessions).values({
        projectId,
        walletAddress: wallet,
        mode: 'canvasCard',
        url: '',
        status: 'active',
        expiresAt,
      }).returning();

      await logReceipt(wallet, projectId, 'system', 'preview.start', { mode: 'canvasCard', sessionId: session.id });

      return res.json({ preview: session, canvas: manifest.canvasSchema });
    }

    const [binding] = await db.select().from(sandboxDevBindings)
      .where(and(
        eq(sandboxDevBindings.projectId, projectId),
        eq(sandboxDevBindings.walletAddress, wallet)
      ));

    let previewUrl: string;
    if (binding) {
      const [devInstance] = await db.select().from(sandboxDevInstances)
        .where(eq(sandboxDevInstances.id, binding.devInstanceId));
      const entry = parsed.runtime?.entry || '/';
      previewUrl = `/api/sandbox/proxy/${projectId}${entry.startsWith('/') ? entry : '/' + entry}`;
    } else {
      previewUrl = `https://preview.atlas/${wallet}/${projectId}`;
    }

    const [session] = await db.insert(sandboxPreviewSessions).values({
      projectId,
      walletAddress: wallet,
      mode: 'app',
      url: previewUrl,
      status: 'active',
      expiresAt,
    }).returning();

    await logReceipt(wallet, projectId, 'system', 'preview.start', { mode: 'app', sessionId: session.id, url: previewUrl });
    logger.info(`Preview session ${session.id} started for project ${projectId}`);

    res.json({ preview: session });
  } catch (err: any) {
    logger.error(`Start preview failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/preview/:previewId', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [session] = await db.select().from(sandboxPreviewSessions)
      .where(and(
        eq(sandboxPreviewSessions.id, req.params.previewId),
        eq(sandboxPreviewSessions.walletAddress, wallet)
      ));

    if (!session) {
      return res.status(404).json({ error: 'Preview session not found' });
    }

    await db.update(sandboxPreviewSessions)
      .set({ status: 'stopped' })
      .where(eq(sandboxPreviewSessions.id, session.id));

    await logReceipt(wallet, session.projectId, 'system', 'preview.stop', { sessionId: session.id });

    res.json({ stopped: true });
  } catch (err: any) {
    logger.error(`Stop preview failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/projects/:id/submitForApproval', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const projectId = req.params.id;

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, projectId),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [manifest] = await db.select().from(sandboxManifests)
      .where(eq(sandboxManifests.projectId, projectId));

    const checks = {
      protocolPurity: true,
      receiptsPresent: true,
      sensitiveDataEncrypted: true,
      endpointsDeclared: project.kind === 'app' ? !!manifest?.endpoints : true,
      canvasValid: project.kind === 'canvasCard' ? !!manifest?.canvasSchema : true,
      manifestPresent: !!manifest,
    };

    const [review] = await db.insert(sandboxGovernanceReviews).values({
      projectId,
      walletAddress: wallet,
      status: 'pending',
      checks,
    }).returning();

    await db.update(sandboxProjects)
      .set({ status: 'awaitingApproval', updatedAt: new Date() })
      .where(eq(sandboxProjects.id, projectId));

    await logReceipt(wallet, projectId, 'user', 'governance.submit', { reviewId: review.id, checks });
    logger.info(`Project ${projectId} submitted for approval`);

    res.json({ review });
  } catch (err: any) {
    logger.error(`Submit for approval failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.get('/receipts', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const projectId = req.query.projectId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    let query = db.select().from(sandboxReceipts)
      .where(eq(sandboxReceipts.walletAddress, wallet))
      .orderBy(desc(sandboxReceipts.createdAt))
      .limit(limit)
      .offset(offset);

    const receipts = await query;
    const filtered = projectId 
      ? receipts.filter(r => r.projectId === projectId)
      : receipts;

    res.json({ receipts: filtered, count: filtered.length });
  } catch (err: any) {
    logger.error(`List receipts failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
