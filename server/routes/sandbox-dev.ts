import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  sandboxDevInstances, sandboxDevBindings, sandboxProjects, sandboxReceipts
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[SANDBOX-DEV] ${msg}`),
  error: (msg: string) => console.error(`[SANDBOX-DEV ERROR] ${msg}`),
};

function deriveEncryptionKey(): Buffer {
  const source = process.env.SANDBOX_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'sandbox-dev-key-fallback';
  return createHash('sha256').update(source).digest();
}

const ENCRYPTION_KEY = deriveEncryptionKey();

function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptToken(ciphertext: string): string | null {
  try {
    const parts = ciphertext.split(':');
    if (parts[0] !== 'v1' || parts.length !== 4) {
      logger.error('Invalid ciphertext format');
      return null;
    }
    const iv = Buffer.from(parts[1], 'base64');
    const authTag = Buffer.from(parts[2], 'base64');
    const encrypted = Buffer.from(parts[3], 'base64');
    const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    logger.error(`Decryption failed: ${err.message}`);
    return null;
  }
}

function requireWallet(req: Request, res: Response): string | null {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(401).json({ error: 'Valid wallet address required' });
    return null;
  }
  return wallet.toLowerCase();
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

const registerDevInstanceSchema = z.object({
  name: z.string().min(2).max(256),
  baseUrl: z.string().url(),
  authToken: z.string().min(10).optional(),
});

const bindDevInstanceSchema = z.object({
  projectId: z.string().uuid(),
  devInstanceId: z.string().uuid(),
});

router.post('/instances/register', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = registerDevInstanceSchema.parse(req.body);
    
    const authTokenEnc = parsed.authToken ? encryptToken(parsed.authToken) : null;

    const [instance] = await db.insert(sandboxDevInstances).values({
      walletAddress: wallet,
      name: parsed.name,
      baseUrl: parsed.baseUrl,
      authTokenEnc: authTokenEnc || undefined,
    }).returning();

    const safeInstance = {
      ...instance,
      authTokenEnc: instance.authTokenEnc ? '[encrypted]' : null,
    };

    await logReceipt(wallet, null, 'user', 'dev.instance.register', { devInstanceId: instance.id });
    logger.info(`Dev instance ${instance.id} registered for wallet ${wallet}`);

    res.status(201).json({ instance: safeInstance });
  } catch (err: any) {
    logger.error(`Register dev instance failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.get('/instances', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const instances = await db.select().from(sandboxDevInstances)
      .where(eq(sandboxDevInstances.walletAddress, wallet))
      .orderBy(desc(sandboxDevInstances.updatedAt));

    const safeInstances = instances.map(inst => ({
      ...inst,
      authTokenEnc: inst.authTokenEnc ? '[encrypted]' : null,
    }));

    res.json({ instances: safeInstances });
  } catch (err: any) {
    logger.error(`List dev instances failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/instances/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [instance] = await db.select().from(sandboxDevInstances)
      .where(and(
        eq(sandboxDevInstances.id, req.params.id),
        eq(sandboxDevInstances.walletAddress, wallet)
      ));

    if (!instance) {
      return res.status(404).json({ error: 'Dev instance not found' });
    }

    await db.delete(sandboxDevInstances)
      .where(eq(sandboxDevInstances.id, instance.id));

    await logReceipt(wallet, null, 'user', 'dev.instance.delete', { devInstanceId: instance.id });
    logger.info(`Dev instance ${instance.id} deleted`);

    res.json({ deleted: true });
  } catch (err: any) {
    logger.error(`Delete dev instance failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/instances/bind', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = bindDevInstanceSchema.parse(req.body);

    const [project] = await db.select().from(sandboxProjects)
      .where(and(
        eq(sandboxProjects.id, parsed.projectId),
        eq(sandboxProjects.walletAddress, wallet)
      ));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [instance] = await db.select().from(sandboxDevInstances)
      .where(and(
        eq(sandboxDevInstances.id, parsed.devInstanceId),
        eq(sandboxDevInstances.walletAddress, wallet)
      ));

    if (!instance) {
      return res.status(404).json({ error: 'Dev instance not found' });
    }

    const [existing] = await db.select().from(sandboxDevBindings)
      .where(and(
        eq(sandboxDevBindings.projectId, parsed.projectId),
        eq(sandboxDevBindings.devInstanceId, parsed.devInstanceId),
        eq(sandboxDevBindings.walletAddress, wallet)
      ));

    if (existing) {
      return res.json({ binding: existing });
    }

    const [binding] = await db.insert(sandboxDevBindings).values({
      walletAddress: wallet,
      projectId: parsed.projectId,
      devInstanceId: parsed.devInstanceId,
    }).returning();

    await logReceipt(wallet, parsed.projectId, 'user', 'dev.instance.bind', { 
      devInstanceId: instance.id, 
      bindingId: binding.id 
    });
    
    logger.info(`Dev instance ${instance.id} bound to project ${project.id}`);

    res.status(201).json({ binding });
  } catch (err: any) {
    logger.error(`Bind dev instance failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/bindings/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [binding] = await db.select().from(sandboxDevBindings)
      .where(and(
        eq(sandboxDevBindings.id, req.params.id),
        eq(sandboxDevBindings.walletAddress, wallet)
      ));

    if (!binding) {
      return res.status(404).json({ error: 'Binding not found' });
    }

    await db.delete(sandboxDevBindings)
      .where(eq(sandboxDevBindings.id, binding.id));

    await logReceipt(wallet, binding.projectId, 'user', 'dev.instance.unbind', { bindingId: binding.id });
    logger.info(`Dev binding ${binding.id} deleted`);

    res.json({ deleted: true });
  } catch (err: any) {
    logger.error(`Delete binding failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/bindings', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const projectId = req.query.projectId as string;

    let bindings = await db.select().from(sandboxDevBindings)
      .where(eq(sandboxDevBindings.walletAddress, wallet))
      .orderBy(desc(sandboxDevBindings.createdAt));

    if (projectId) {
      bindings = bindings.filter(b => b.projectId === projectId);
    }

    res.json({ bindings });
  } catch (err: any) {
    logger.error(`List bindings failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
