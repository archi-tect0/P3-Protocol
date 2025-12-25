import { Router } from 'express';
import { z } from 'zod';
import { getStorageInstance, hasStorageInstance } from '../../storage-accessor';
import * as vault from '../services/vault';

const router = Router();

const updateProfileSchema = z.object({
  wallet: z.string().min(1),
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
  sessionMemoryEnabled: z.boolean().optional(),
  rememberPinnedApps: z.boolean().optional(),
  rememberQueries: z.boolean().optional(),
  rememberFlowHistory: z.boolean().optional(),
  onboardingCompletedAt: z.string().datetime().optional(),
  onboardingPath: z.string().max(16).optional(),
});

router.get('/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    
    if (!hasStorageInstance()) {
      return res.json({ ok: true, profile: null });
    }
    
    const storage = getStorageInstance();
    const profile = await storage.getWalletProfile(wallet.toLowerCase());
    
    if (!profile) {
      return res.json({ 
        ok: true, 
        profile: {
          wallet: wallet.toLowerCase(),
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
        }
      });
    }
    
    res.json({ ok: true, profile });
  } catch (error) {
    console.error('[Profile] Get error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get profile' });
  }
});

router.put('/', async (req, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.message });
    }
    
    const data = parsed.data;
    
    if (!hasStorageInstance()) {
      return res.json({ ok: true, profile: data });
    }
    
    const storage = getStorageInstance();
    const existing = await storage.getWalletProfile(data.wallet.toLowerCase());
    
    const profileData = {
      wallet: data.wallet.toLowerCase(),
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
    
    const receiptHash = `0x${Buffer.from(JSON.stringify({ 
      wallet: data.wallet, 
      action: 'profile.update',
      timestamp: Date.now() 
    })).toString('hex').slice(0, 64)}`;
    
    res.json({ 
      ok: true, 
      profile,
      receipt: {
        hash: receiptHash,
        scope: 'atlas.profile.update',
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Profile] Update error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update profile' });
  }
});

router.get('/vault/providers', async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) {
      return res.status(400).json({ ok: false, error: 'Wallet required' });
    }
    
    const providers = await vault.getConfiguredProviders(wallet);
    res.json({ ok: true, providers });
  } catch (error) {
    console.error('[Profile] Get providers error:', error);
    res.status(500).json({ ok: false, error: 'Failed to get providers' });
  }
});

router.post('/vault/developer-key', async (req, res) => {
  try {
    const { wallet, provider, apiKey } = req.body;
    
    if (!wallet || !provider || !apiKey) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    
    const validation = await vault.validateProviderKey(provider, apiKey);
    if (!validation.valid) {
      return res.status(400).json({ ok: false, error: validation.error || 'Invalid API key format' });
    }
    
    const saved = await vault.setDeveloperKey(wallet, provider, apiKey);
    
    if (!saved) {
      return res.status(500).json({ ok: false, error: 'Failed to save key' });
    }
    
    const receiptHash = `0x${Buffer.from(JSON.stringify({ 
      wallet, 
      provider,
      action: 'developer_key.set',
      timestamp: Date.now() 
    })).toString('hex').slice(0, 64)}`;
    
    res.json({ 
      ok: true,
      receipt: {
        hash: receiptHash,
        scope: 'atlas.vault.developer_key',
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('[Profile] Set developer key error:', error);
    res.status(500).json({ ok: false, error: 'Failed to save developer key' });
  }
});

router.delete('/vault/developer-key', async (req, res) => {
  try {
    const { wallet, provider } = req.body;
    
    if (!wallet || !provider) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    
    const deleted = await vault.deleteCredential(wallet, 'developer', provider);
    
    res.json({ ok: deleted });
  } catch (error) {
    console.error('[Profile] Delete developer key error:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete developer key' });
  }
});

router.post('/vault/validate-key', async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ ok: false, valid: false, error: 'Missing fields' });
    }
    
    const result = await vault.validateProviderKey(provider, apiKey);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, valid: false, error: 'Validation failed' });
  }
});

export default router;
