/**
 * Encrypted Session Vault API Routes
 * 
 * Provides server-side persistence for encrypted vault blobs
 * All encryption/decryption happens client-side using WebCrypto
 * Server only stores opaque encrypted blobs
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { vaultKeys, vaultAppKeys, vaultBlobs } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

const initVaultSchema = z.object({
  walletAddress: z.string().min(1),
  encryptedMasterKey: z.string().min(1),
});

const saveBlobSchema = z.object({
  walletAddress: z.string().min(1),
  encryptedBlob: z.string().min(1),
  keyDerivationSalt: z.string().optional(),
});

const panicSchema = z.object({
  walletAddress: z.string().min(1),
});

/**
 * POST /api/vault/init
 * Initialize vault with encrypted master key (encrypted client-side)
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const { walletAddress, encryptedMasterKey } = initVaultSchema.parse(req.body);
    const normalizedAddress = walletAddress.toLowerCase();
    
    const existingKey = await db
      .select()
      .from(vaultKeys)
      .where(and(
        eq(vaultKeys.walletAddress, normalizedAddress),
        eq(vaultKeys.status, 'active')
      ))
      .limit(1);
    
    if (existingKey.length > 0) {
      return res.json({
        success: true,
        keyId: existingKey[0].id,
        keyVersion: existingKey[0].keyVersion,
        message: 'Vault already initialized',
      });
    }
    
    const [newKey] = await db
      .insert(vaultKeys)
      .values({
        walletAddress: normalizedAddress,
        encryptedMasterKey,
        keyVersion: 1,
        status: 'active',
      })
      .returning();
    
    res.json({
      success: true,
      keyId: newKey.id,
      keyVersion: newKey.keyVersion,
      message: 'Vault initialized',
    });
  } catch (error) {
    console.error('[vault] Init error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to initialize vault' });
  }
});

/**
 * GET /api/vault/status/:walletAddress
 * Check vault status for a wallet
 */
router.get('/status/:walletAddress', async (req: Request, res: Response) => {
  try {
    const normalizedAddress = req.params.walletAddress.toLowerCase();
    
    const activeKey = await db
      .select()
      .from(vaultKeys)
      .where(and(
        eq(vaultKeys.walletAddress, normalizedAddress),
        eq(vaultKeys.status, 'active')
      ))
      .limit(1);
    
    if (activeKey.length === 0) {
      return res.json({
        initialized: false,
        revoked: false,
      });
    }
    
    res.json({
      initialized: true,
      revoked: false,
      keyVersion: activeKey[0].keyVersion,
      createdAt: activeKey[0].createdAt,
    });
  } catch (error) {
    console.error('[vault] Status error:', error);
    res.status(500).json({ error: 'Failed to get vault status' });
  }
});

/**
 * GET /api/vault/blobs/:appSlug
 * Get encrypted blob for an app (client decrypts)
 */
router.get('/blobs/:appSlug', async (req: Request, res: Response) => {
  try {
    const { appSlug } = req.params;
    const walletAddress = (req.query.wallet as string || '').toLowerCase();
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    const activeKey = await db
      .select()
      .from(vaultKeys)
      .where(and(
        eq(vaultKeys.walletAddress, walletAddress),
        eq(vaultKeys.status, 'active')
      ))
      .limit(1);
    
    if (activeKey.length === 0) {
      return res.status(403).json({ error: 'Vault not initialized or revoked' });
    }
    
    const blob = await db
      .select()
      .from(vaultBlobs)
      .where(and(
        eq(vaultBlobs.walletAddress, walletAddress),
        eq(vaultBlobs.appSlug, appSlug)
      ))
      .limit(1);
    
    if (blob.length === 0) {
      return res.json({ found: false, blob: null });
    }
    
    const appKey = await db
      .select()
      .from(vaultAppKeys)
      .where(and(
        eq(vaultAppKeys.walletAddress, walletAddress),
        eq(vaultAppKeys.appSlug, appSlug)
      ))
      .orderBy(desc(vaultAppKeys.versionId))
      .limit(1);
    
    res.json({
      found: true,
      blob: blob[0].encryptedBlob,
      keyDerivationSalt: appKey.length > 0 ? appKey[0].keyDerivationSalt : null,
      versionId: appKey.length > 0 ? appKey[0].versionId : null,
      updatedAt: blob[0].updatedAt,
    });
  } catch (error) {
    console.error('[vault] Get blob error:', error);
    res.status(500).json({ error: 'Failed to get blob' });
  }
});

/**
 * POST /api/vault/blobs/:appSlug
 * Save encrypted blob for an app
 */
router.post('/blobs/:appSlug', async (req: Request, res: Response) => {
  try {
    const { appSlug } = req.params;
    const { walletAddress, encryptedBlob, keyDerivationSalt } = saveBlobSchema.parse(req.body);
    const normalizedAddress = walletAddress.toLowerCase();
    
    const activeKey = await db
      .select()
      .from(vaultKeys)
      .where(and(
        eq(vaultKeys.walletAddress, normalizedAddress),
        eq(vaultKeys.status, 'active')
      ))
      .limit(1);
    
    if (activeKey.length === 0) {
      return res.status(403).json({ error: 'Vault not initialized or revoked' });
    }
    
    const existingBlob = await db
      .select()
      .from(vaultBlobs)
      .where(and(
        eq(vaultBlobs.walletAddress, normalizedAddress),
        eq(vaultBlobs.appSlug, appSlug)
      ))
      .limit(1);
    
    if (existingBlob.length > 0) {
      await db
        .update(vaultBlobs)
        .set({
          encryptedBlob,
          updatedAt: new Date(),
        })
        .where(eq(vaultBlobs.id, existingBlob[0].id));
    } else {
      await db
        .insert(vaultBlobs)
        .values({
          walletAddress: normalizedAddress,
          appSlug,
          encryptedBlob,
        });
    }
    
    if (keyDerivationSalt) {
      const existingAppKey = await db
        .select()
        .from(vaultAppKeys)
        .where(and(
          eq(vaultAppKeys.walletAddress, normalizedAddress),
          eq(vaultAppKeys.appSlug, appSlug)
        ))
        .orderBy(desc(vaultAppKeys.versionId))
        .limit(1);
      
      const newVersion = existingAppKey.length > 0 ? existingAppKey[0].versionId + 1 : 1;
      
      await db
        .insert(vaultAppKeys)
        .values({
          walletAddress: normalizedAddress,
          appSlug,
          versionId: newVersion,
          keyDerivationSalt,
        });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[vault] Save blob error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to save blob' });
  }
});

/**
 * POST /api/vault/rotate/:appSlug
 * Rotate app key (forward secrecy on install/update)
 */
router.post('/rotate/:appSlug', async (req: Request, res: Response) => {
  try {
    const { appSlug } = req.params;
    const { walletAddress, keyDerivationSalt, encryptedBlob } = saveBlobSchema.parse(req.body);
    const normalizedAddress = walletAddress.toLowerCase();
    
    const activeKey = await db
      .select()
      .from(vaultKeys)
      .where(and(
        eq(vaultKeys.walletAddress, normalizedAddress),
        eq(vaultKeys.status, 'active')
      ))
      .limit(1);
    
    if (activeKey.length === 0) {
      return res.status(403).json({ error: 'Vault not initialized or revoked' });
    }
    
    const existingAppKey = await db
      .select()
      .from(vaultAppKeys)
      .where(and(
        eq(vaultAppKeys.walletAddress, normalizedAddress),
        eq(vaultAppKeys.appSlug, appSlug)
      ))
      .orderBy(desc(vaultAppKeys.versionId))
      .limit(1);
    
    const newVersion = existingAppKey.length > 0 ? existingAppKey[0].versionId + 1 : 1;
    
    await db
      .insert(vaultAppKeys)
      .values({
        walletAddress: normalizedAddress,
        appSlug,
        versionId: newVersion,
        keyDerivationSalt: keyDerivationSalt || '',
      });
    
    const existingBlob = await db
      .select()
      .from(vaultBlobs)
      .where(and(
        eq(vaultBlobs.walletAddress, normalizedAddress),
        eq(vaultBlobs.appSlug, appSlug)
      ))
      .limit(1);
    
    if (existingBlob.length > 0 && encryptedBlob) {
      await db
        .update(vaultBlobs)
        .set({
          encryptedBlob,
          updatedAt: new Date(),
        })
        .where(eq(vaultBlobs.id, existingBlob[0].id));
    } else if (encryptedBlob) {
      await db
        .insert(vaultBlobs)
        .values({
          walletAddress: normalizedAddress,
          appSlug,
          encryptedBlob,
        });
    }
    
    res.json({
      success: true,
      newVersion,
      message: `App key rotated to version ${newVersion}`,
    });
  } catch (error) {
    console.error('[vault] Rotate error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to rotate app key' });
  }
});

/**
 * POST /api/vault/panic
 * Emergency wipe - mark all keys as revoked instantly
 */
router.post('/panic', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = panicSchema.parse(req.body);
    const normalizedAddress = walletAddress.toLowerCase();
    
    await db
      .update(vaultKeys)
      .set({
        status: 'revoked',
        rotatedAt: new Date(),
      })
      .where(eq(vaultKeys.walletAddress, normalizedAddress));
    
    const deletedBlobs = await db
      .delete(vaultBlobs)
      .where(eq(vaultBlobs.walletAddress, normalizedAddress))
      .returning();
    
    const deletedAppKeys = await db
      .delete(vaultAppKeys)
      .where(eq(vaultAppKeys.walletAddress, normalizedAddress))
      .returning();
    
    console.log(`[vault] PANIC triggered for ${normalizedAddress}: ${deletedBlobs.length} blobs, ${deletedAppKeys.length} app keys wiped`);
    
    res.json({
      success: true,
      message: 'All vault keys revoked and data wiped',
      blobsDeleted: deletedBlobs.length,
      appKeysDeleted: deletedAppKeys.length,
    });
  } catch (error) {
    console.error('[vault] Panic error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to execute panic wipe' });
  }
});

/**
 * DELETE /api/vault/app/:appSlug
 * Wipe single app data
 */
router.delete('/app/:appSlug', async (req: Request, res: Response) => {
  try {
    const { appSlug } = req.params;
    const walletAddress = (req.query.wallet as string || '').toLowerCase();
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    const deletedBlobs = await db
      .delete(vaultBlobs)
      .where(and(
        eq(vaultBlobs.walletAddress, walletAddress),
        eq(vaultBlobs.appSlug, appSlug)
      ))
      .returning();
    
    const deletedAppKeys = await db
      .delete(vaultAppKeys)
      .where(and(
        eq(vaultAppKeys.walletAddress, walletAddress),
        eq(vaultAppKeys.appSlug, appSlug)
      ))
      .returning();
    
    console.log(`[vault] App data wiped for ${appSlug}: ${deletedBlobs.length} blobs, ${deletedAppKeys.length} app keys`);
    
    res.json({
      success: true,
      appSlug,
      blobsDeleted: deletedBlobs.length,
      appKeysDeleted: deletedAppKeys.length,
    });
  } catch (error) {
    console.error('[vault] Delete app error:', error);
    res.status(500).json({ error: 'Failed to delete app data' });
  }
});

/**
 * GET /api/vault/apps
 * List all apps with vault data for a wallet
 */
router.get('/apps', async (req: Request, res: Response) => {
  try {
    const walletAddress = (req.query.wallet as string || '').toLowerCase();
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }
    
    const blobs = await db
      .select({
        appSlug: vaultBlobs.appSlug,
        updatedAt: vaultBlobs.updatedAt,
      })
      .from(vaultBlobs)
      .where(eq(vaultBlobs.walletAddress, walletAddress));
    
    res.json({
      apps: blobs.map(b => ({
        appSlug: b.appSlug,
        lastUpdated: b.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[vault] List apps error:', error);
    res.status(500).json({ error: 'Failed to list apps' });
  }
});

export default router;
