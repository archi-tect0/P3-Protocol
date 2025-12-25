import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { didDocs, reputations, auditLog } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../auth';
import { keccak256, toHex, toBytes } from 'viem';
import { rootLogger } from '../observability/logger';
import { getStorageInstance, hasStorageInstance } from '../storage-accessor';
import * as vault from '../atlas/services/vault';

const router = Router();
const logger = rootLogger.child({ module: 'identity' });

const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string || '').toLowerCase() || null;
}

function createReceipt(action: string, wallet: string, extra?: Record<string, unknown>) {
  const timestamp = Date.now();
  const receiptData = { wallet, action, timestamp, ...extra };
  const hash = `0x${Buffer.from(JSON.stringify(receiptData)).toString('hex').slice(0, 64)}`;
  return {
    hash,
    scope: `identity.${action}`,
    timestamp,
    'data-testid': `receipt-${action}`,
  };
}

function hashDocument(doc: unknown): string {
  const data = JSON.stringify(doc);
  return keccak256(toHex(toBytes(data)));
}

async function logAuditEvent(
  entityType: string,
  entityId: string,
  action: string,
  actor: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      entityType,
      entityId,
      action,
      actor,
      meta: meta || null,
    });
  } catch (error) {
    logger.error('Failed to log audit event', error as Error);
  }
}

const issueDIDSchema = z.object({
  walletId: z.string().min(1).max(128),
  doc: z.object({
    '@context': z.array(z.string()).optional(),
    id: z.string().optional(),
    verificationMethod: z.array(z.any()).optional(),
    authentication: z.array(z.any()).optional(),
    service: z.array(z.any()).optional(),
  }).passthrough(),
  expiresAt: z.string().datetime().optional(),
});

const revokeDIDSchema = z.object({
  walletId: z.string().min(1).max(128),
  docId: z.number().optional(),
  reason: z.string().max(256).optional(),
});

const updateReputationSchema = z.object({
  walletId: z.string().min(1).max(128),
  score: z.number().int().min(-1000).max(1000),
  reason: z.string().max(256).optional(),
});

router.post('/did/issue', apiKeyAuth(true), authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const result = issueDIDSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      error: 'Invalid request', 
      details: result.error.errors 
    });
  }

  const { walletId, doc, expiresAt } = result.data;
  const actor = req.user?.userId || 'unknown';

  try {
    const didDoc = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: `did:p3:${walletId}`,
      ...doc,
    };

    const docHash = hashDocument(didDoc);

    const [issued] = await db
      .insert(didDocs)
      .values({
        walletId,
        doc: didDoc,
        docHash,
        revoked: false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    await logAuditEvent(
      'did_doc',
      String(issued.id),
      'issue',
      actor,
      { walletId, docHash }
    );

    logger.info('DID document issued', { walletId, docId: issued.id, docHash });

    res.status(201).json({
      ok: true,
      did: {
        id: issued.id,
        walletId: issued.walletId,
        doc: issued.doc,
        docHash: issued.docHash,
        createdAt: issued.createdAt,
        expiresAt: issued.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Failed to issue DID document', error as Error);
    res.status(500).json({ error: 'Failed to issue DID document' });
  }
});

router.post('/did/revoke', apiKeyAuth(true), authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
  const result = revokeDIDSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      error: 'Invalid request', 
      details: result.error.errors 
    });
  }

  const { walletId, docId, reason } = result.data;
  const actor = req.user?.userId || 'unknown';

  try {
    let query;
    if (docId) {
      query = eq(didDocs.id, docId);
    } else {
      const [latest] = await db
        .select()
        .from(didDocs)
        .where(eq(didDocs.walletId, walletId))
        .orderBy(desc(didDocs.createdAt))
        .limit(1);

      if (!latest) {
        return res.status(404).json({ error: 'No DID document found for this wallet' });
      }

      if (latest.revoked) {
        return res.status(400).json({ error: 'DID document is already revoked' });
      }

      query = eq(didDocs.id, latest.id);
    }

    const [revoked] = await db
      .update(didDocs)
      .set({ revoked: true })
      .where(query)
      .returning();

    if (!revoked) {
      return res.status(404).json({ error: 'DID document not found' });
    }

    await logAuditEvent(
      'did_doc',
      String(revoked.id),
      'revoke',
      actor,
      { walletId, reason, docHash: revoked.docHash }
    );

    logger.info('DID document revoked', { walletId, docId: revoked.id, reason });

    res.json({
      ok: true,
      revoked: {
        id: revoked.id,
        walletId: revoked.walletId,
        docHash: revoked.docHash,
        revokedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to revoke DID document', error as Error);
    res.status(500).json({ error: 'Failed to revoke DID document' });
  }
});

router.post('/reputation/update', apiKeyAuth(true), authenticateJWT, requireRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
  const result = updateReputationSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ 
      error: 'Invalid request', 
      details: result.error.errors 
    });
  }

  const { walletId, score, reason } = result.data;
  const actor = req.user?.userId || 'unknown';

  try {
    const [existing] = await db
      .select()
      .from(reputations)
      .where(eq(reputations.walletId, walletId))
      .limit(1);

    let updated;
    if (existing) {
      [updated] = await db
        .update(reputations)
        .set({
          score,
          reason: reason || existing.reason,
          updatedAt: new Date(),
        })
        .where(eq(reputations.walletId, walletId))
        .returning();
    } else {
      [updated] = await db
        .insert(reputations)
        .values({
          walletId,
          score,
          reason: reason || null,
        })
        .returning();
    }

    await logAuditEvent(
      'reputation',
      walletId,
      existing ? 'update' : 'create',
      actor,
      { 
        previousScore: existing?.score, 
        newScore: score, 
        reason 
      }
    );

    logger.info('Reputation updated', { 
      walletId, 
      previousScore: existing?.score, 
      newScore: score 
    });

    res.json({
      ok: true,
      reputation: {
        walletId: updated.walletId,
        score: updated.score,
        reason: updated.reason,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to update reputation', error as Error);
    res.status(500).json({ error: 'Failed to update reputation' });
  }
});

router.get('/reputation/:walletId', async (req: Request, res: Response) => {
  const { walletId } = req.params;

  if (!walletId || walletId.length > 128) {
    return res.status(400).json({ error: 'Invalid wallet ID' });
  }

  try {
    const [reputation] = await db
      .select()
      .from(reputations)
      .where(eq(reputations.walletId, walletId))
      .limit(1);

    if (!reputation) {
      return res.json({
        walletId,
        score: 0,
        reason: null,
        updatedAt: null,
        exists: false,
      });
    }

    res.json({
      walletId: reputation.walletId,
      score: reputation.score,
      reason: reputation.reason,
      updatedAt: reputation.updatedAt,
      exists: true,
    });
  } catch (error) {
    logger.error('Failed to fetch reputation', error as Error);
    res.status(500).json({ error: 'Failed to fetch reputation' });
  }
});

router.get('/did/:walletId', async (req: Request, res: Response) => {
  const { walletId } = req.params;
  const includeRevoked = req.query.includeRevoked === 'true';

  if (!walletId || walletId.length > 128) {
    return res.status(400).json({ error: 'Invalid wallet ID' });
  }

  try {
    let query = db
      .select()
      .from(didDocs)
      .where(eq(didDocs.walletId, walletId))
      .orderBy(desc(didDocs.createdAt));

    const docs = await query;

    const filteredDocs = includeRevoked 
      ? docs 
      : docs.filter(doc => !doc.revoked);

    if (filteredDocs.length === 0) {
      return res.status(404).json({ 
        error: 'No DID documents found for this wallet',
        walletId,
      });
    }

    res.json({
      walletId,
      documents: filteredDocs.map(doc => ({
        id: doc.id,
        doc: doc.doc,
        docHash: doc.docHash,
        revoked: doc.revoked,
        createdAt: doc.createdAt,
        expiresAt: doc.expiresAt,
      })),
      count: filteredDocs.length,
    });
  } catch (error) {
    logger.error('Failed to fetch DID documents', error as Error);
    res.status(500).json({ error: 'Failed to fetch DID documents' });
  }
});

const updateProfileSchema = z.object({
  displayName: z.string().max(64).optional(),
  avatarCid: z.string().max(128).optional(),
  facePreset: z.string().max(32).optional(),
  interfacePreference: z.enum(['canvas', 'chat']).optional(),
  voiceStyle: z.enum(['default', 'calm', 'energetic', 'professional', 'friendly']).optional(),
  voiceGender: z.enum(['neutral', 'masculine', 'feminine']).optional(),
  voiceSpeed: z.number().min(50).max(200).optional(),
  themeMode: z.string().max(16).optional(),
  primaryColor: z.string().max(32).optional(),
  pinnedManifests: z.array(z.string()).optional(),
});

const saveProviderKeySchema = z.object({
  apiKey: z.string().min(1),
});

const updatePreferencesSchema = z.object({
  sessionMemoryEnabled: z.boolean().optional(),
  rememberPinnedApps: z.boolean().optional(),
  rememberQueries: z.boolean().optional(),
  rememberFlowHistory: z.boolean().optional(),
  onboardingCompletedAt: z.string().datetime().optional(),
  onboardingPath: z.string().max(16).optional(),
});

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ 
        error: 'Wallet address required',
        'data-testid': 'error-wallet-required',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    if (!hasStorageInstance()) {
      const defaultProfile = {
        wallet,
        displayName: null,
        avatarCid: null,
        facePreset: 'line',
        interfacePreference: 'canvas',
        voiceStyle: 'default',
        voiceGender: 'neutral',
        voiceSpeed: 100,
        themeMode: 'dark',
        primaryColor: 'purple',
        pinnedManifests: [],
        sessionMemoryEnabled: true,
        rememberPinnedApps: true,
        rememberQueries: false,
        rememberFlowHistory: true,
        onboardingCompletedAt: null,
        onboardingPath: null,
      };
      
      return res.json({
        profile: defaultProfile,
        'data-testid': 'profile-default',
        receipt: createReceipt('profile.get', wallet),
      });
    }

    const storage = getStorageInstance();
    const profile = await storage.getWalletProfile(wallet);

    if (!profile) {
      const defaultProfile = {
        wallet,
        displayName: null,
        avatarCid: null,
        facePreset: 'line',
        interfacePreference: 'canvas',
        voiceStyle: 'default',
        voiceGender: 'neutral',
        voiceSpeed: 100,
        themeMode: 'dark',
        primaryColor: 'purple',
        pinnedManifests: [],
        sessionMemoryEnabled: true,
        rememberPinnedApps: true,
        rememberQueries: false,
        rememberFlowHistory: true,
        onboardingCompletedAt: null,
        onboardingPath: null,
      };

      logger.info(`Returning default profile for wallet ${wallet}`);
      return res.json({
        profile: defaultProfile,
        'data-testid': 'profile-default',
        receipt: createReceipt('profile.get', wallet),
      });
    }

    logger.info(`Retrieved profile for wallet ${wallet}`);
    res.json({
      profile,
      'data-testid': 'profile-loaded',
      receipt: createReceipt('profile.get', wallet),
    });
  } catch (err: any) {
    logger.error(`Failed to get profile: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to get profile',
      'data-testid': 'error-profile-get',
      receipt: { status: 'error', timestamp: Date.now() }
    });
  }
});

router.patch('/profile', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ 
        error: 'Wallet address required',
        'data-testid': 'error-wallet-required',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: parsed.error.errors,
        'data-testid': 'error-validation',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const data = parsed.data;

    if (!hasStorageInstance()) {
      return res.json({
        profile: { wallet, ...data },
        'data-testid': 'profile-updated',
        receipt: createReceipt('profile.update', wallet),
      });
    }

    const storage = getStorageInstance();
    const existing = await storage.getWalletProfile(wallet);

    const profileData = {
      wallet,
      displayName: data.displayName ?? existing?.displayName ?? null,
      avatarCid: data.avatarCid ?? existing?.avatarCid ?? null,
      facePreset: data.facePreset ?? existing?.facePreset ?? 'line',
      interfacePreference: data.interfacePreference ?? existing?.interfacePreference ?? 'canvas',
      voiceStyle: data.voiceStyle ?? existing?.voiceStyle ?? 'default',
      voiceGender: data.voiceGender ?? existing?.voiceGender ?? 'neutral',
      voiceSpeed: data.voiceSpeed ?? existing?.voiceSpeed ?? 100,
      themeMode: data.themeMode ?? existing?.themeMode ?? 'dark',
      primaryColor: data.primaryColor ?? existing?.primaryColor ?? 'purple',
      pinnedManifests: data.pinnedManifests ?? existing?.pinnedManifests ?? [],
      sessionMemoryEnabled: existing?.sessionMemoryEnabled ?? true,
      rememberPinnedApps: existing?.rememberPinnedApps ?? true,
      rememberQueries: existing?.rememberQueries ?? false,
      rememberFlowHistory: existing?.rememberFlowHistory ?? true,
      onboardingCompletedAt: existing?.onboardingCompletedAt ?? null,
      onboardingPath: existing?.onboardingPath ?? null,
    };

    const profile = await storage.upsertWalletProfile(profileData);

    logger.info(`Updated profile for wallet ${wallet}`);
    res.json({
      profile,
      'data-testid': 'profile-updated',
      receipt: createReceipt('profile.update', wallet),
    });
  } catch (err: any) {
    logger.error(`Failed to update profile: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to update profile',
      'data-testid': 'error-profile-update',
      receipt: { status: 'error', timestamp: Date.now() }
    });
  }
});

router.get('/providers', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ 
        error: 'Wallet address required',
        'data-testid': 'error-wallet-required',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const configuredProviders = await vault.getConfiguredProviders(wallet);
    
    const providers = SUPPORTED_PROVIDERS.map(provider => ({
      id: provider,
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
      configured: configuredProviders.includes(provider),
      'data-testid': `provider-${provider}`,
    }));

    logger.info(`Listed providers for wallet ${wallet}: ${configuredProviders.length} configured`);
    res.json({
      providers,
      configured: configuredProviders,
      count: configuredProviders.length,
      'data-testid': 'providers-list',
      receipt: createReceipt('providers.list', wallet),
    });
  } catch (err: any) {
    logger.error(`Failed to list providers: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to list providers',
      'data-testid': 'error-providers-list',
      receipt: { status: 'error', timestamp: Date.now() }
    });
  }
});

router.post('/providers/:provider', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ 
        error: 'Wallet address required',
        'data-testid': 'error-wallet-required',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const provider = req.params.provider.toLowerCase();
    if (!SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)) {
      return res.status(400).json({ 
        error: `Unsupported provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
        'data-testid': 'error-unsupported-provider',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const parsed = saveProviderKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: parsed.error.errors,
        'data-testid': 'error-validation',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const { apiKey } = parsed.data;

    const validation = await vault.validateProviderKey(provider, apiKey);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.error || 'Invalid API key format',
        'data-testid': 'error-invalid-key',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const saved = await vault.setDeveloperKey(wallet, provider, apiKey);
    if (!saved) {
      return res.status(500).json({ 
        error: 'Failed to save API key',
        'data-testid': 'error-save-key',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    logger.info(`Saved ${provider} API key for wallet ${wallet}`);
    res.json({
      success: true,
      provider,
      'data-testid': `provider-${provider}-saved`,
      receipt: createReceipt('provider.save', wallet, { provider }),
    });
  } catch (err: any) {
    logger.error(`Failed to save provider key: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to save API key',
      'data-testid': 'error-provider-save',
      receipt: { status: 'error', timestamp: Date.now() }
    });
  }
});

router.delete('/providers/:provider', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ 
        error: 'Wallet address required',
        'data-testid': 'error-wallet-required',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const provider = req.params.provider.toLowerCase();
    if (!SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)) {
      return res.status(400).json({ 
        error: `Unsupported provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
        'data-testid': 'error-unsupported-provider',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const deleted = await vault.deleteCredential(wallet, 'developer', provider);

    logger.info(`Deleted ${provider} API key for wallet ${wallet}: ${deleted}`);
    res.json({
      success: deleted,
      provider,
      'data-testid': `provider-${provider}-deleted`,
      receipt: createReceipt('provider.delete', wallet, { provider }),
    });
  } catch (err: any) {
    logger.error(`Failed to delete provider key: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to delete API key',
      'data-testid': 'error-provider-delete',
      receipt: { status: 'error', timestamp: Date.now() }
    });
  }
});

router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ 
        error: 'Wallet address required',
        'data-testid': 'error-wallet-required',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const defaultPreferences = {
      sessionMemoryEnabled: true,
      rememberPinnedApps: true,
      rememberQueries: false,
      rememberFlowHistory: true,
      onboardingCompletedAt: null,
      onboardingPath: null,
    };

    if (!hasStorageInstance()) {
      return res.json({
        preferences: defaultPreferences,
        'data-testid': 'preferences-default',
        receipt: createReceipt('preferences.get', wallet),
      });
    }

    const storage = getStorageInstance();
    const profile = await storage.getWalletProfile(wallet);

    const preferences = profile ? {
      sessionMemoryEnabled: profile.sessionMemoryEnabled ?? true,
      rememberPinnedApps: profile.rememberPinnedApps ?? true,
      rememberQueries: profile.rememberQueries ?? false,
      rememberFlowHistory: profile.rememberFlowHistory ?? true,
      onboardingCompletedAt: profile.onboardingCompletedAt,
      onboardingPath: profile.onboardingPath,
    } : defaultPreferences;

    logger.info(`Retrieved preferences for wallet ${wallet}`);
    res.json({
      preferences,
      'data-testid': profile ? 'preferences-loaded' : 'preferences-default',
      receipt: createReceipt('preferences.get', wallet),
    });
  } catch (err: any) {
    logger.error(`Failed to get preferences: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to get preferences',
      'data-testid': 'error-preferences-get',
      receipt: { status: 'error', timestamp: Date.now() }
    });
  }
});

router.post('/preferences', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ 
        error: 'Wallet address required',
        'data-testid': 'error-wallet-required',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const parsed = updatePreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: parsed.error.errors,
        'data-testid': 'error-validation',
        receipt: { status: 'error', timestamp: Date.now() }
      });
    }

    const data = parsed.data;

    if (!hasStorageInstance()) {
      return res.json({
        preferences: data,
        'data-testid': 'preferences-updated',
        receipt: createReceipt('preferences.update', wallet),
      });
    }

    const storage = getStorageInstance();
    const existing = await storage.getWalletProfile(wallet);

    const profileData = {
      wallet,
      displayName: existing?.displayName ?? null,
      avatarCid: existing?.avatarCid ?? null,
      facePreset: existing?.facePreset ?? 'line',
      interfacePreference: existing?.interfacePreference ?? 'canvas',
      voiceStyle: existing?.voiceStyle ?? 'default',
      voiceGender: existing?.voiceGender ?? 'neutral',
      voiceSpeed: existing?.voiceSpeed ?? 100,
      themeMode: existing?.themeMode ?? 'dark',
      primaryColor: existing?.primaryColor ?? 'purple',
      pinnedManifests: existing?.pinnedManifests ?? [],
      sessionMemoryEnabled: data.sessionMemoryEnabled ?? existing?.sessionMemoryEnabled ?? true,
      rememberPinnedApps: data.rememberPinnedApps ?? existing?.rememberPinnedApps ?? true,
      rememberQueries: data.rememberQueries ?? existing?.rememberQueries ?? false,
      rememberFlowHistory: data.rememberFlowHistory ?? existing?.rememberFlowHistory ?? true,
      onboardingCompletedAt: data.onboardingCompletedAt 
        ? new Date(data.onboardingCompletedAt) 
        : existing?.onboardingCompletedAt ?? null,
      onboardingPath: data.onboardingPath ?? existing?.onboardingPath ?? null,
    };

    const profile = await storage.upsertWalletProfile(profileData);

    const preferences = {
      sessionMemoryEnabled: profile.sessionMemoryEnabled,
      rememberPinnedApps: profile.rememberPinnedApps,
      rememberQueries: profile.rememberQueries,
      rememberFlowHistory: profile.rememberFlowHistory,
      onboardingCompletedAt: profile.onboardingCompletedAt,
      onboardingPath: profile.onboardingPath,
    };

    logger.info(`Updated preferences for wallet ${wallet}`);
    res.json({
      preferences,
      'data-testid': 'preferences-updated',
      receipt: createReceipt('preferences.update', wallet),
    });
  } catch (err: any) {
    logger.error(`Failed to update preferences: ${err.message}`);
    res.status(500).json({ 
      error: 'Failed to update preferences',
      'data-testid': 'error-preferences-update',
      receipt: { status: 'error', timestamp: Date.now() }
    });
  }
});

export default router;
