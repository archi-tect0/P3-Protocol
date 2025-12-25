import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { ssoProviders, ssoIdentities, insertSsoProviderSchema, insertSsoIdentitySchema } from '@shared/schema';
import { randomBytes } from 'crypto';

const router = Router();

interface AuthenticatedRequest extends Request {
  wallet?: string;
  tenantId?: string;
  apiKey?: any;
}

function requireAdminWallet(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const adminWallet = process.env.ADMIN_WALLET?.toLowerCase();
  const requestWallet = req.wallet?.toLowerCase();
  
  if (!requestWallet || requestWallet !== adminWallet) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

router.get('/providers', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.query.tenantId as string || req.tenantId;
    
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant ID required' });
      return;
    }
    
    const providers = await db.select({
      id: ssoProviders.id,
      tenantId: ssoProviders.tenantId,
      type: ssoProviders.type,
      issuer: ssoProviders.issuer,
      clientId: ssoProviders.clientId,
      callbackUrl: ssoProviders.callbackUrl,
      metadataUrl: ssoProviders.metadataUrl,
      active: ssoProviders.active,
    }).from(ssoProviders)
      .where(eq(ssoProviders.tenantId, tenantId));
    
    res.json({ providers });
  } catch (error) {
    console.error('Error fetching SSO providers:', error);
    res.status(500).json({ error: 'Failed to fetch SSO providers' });
  }
});

router.post('/providers', requireAdminWallet, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = insertSsoProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid provider data', details: parsed.error.errors });
      return;
    }
    
    const [provider] = await db.insert(ssoProviders).values(parsed.data).returning();
    
    res.status(201).json({
      success: true,
      provider: {
        id: provider.id,
        type: provider.type,
        issuer: provider.issuer,
        active: provider.active,
      },
    });
  } catch (error) {
    console.error('Error creating SSO provider:', error);
    res.status(500).json({ error: 'Failed to create SSO provider' });
  }
});

router.delete('/providers/:id', requireAdminWallet, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.delete(ssoProviders).where(eq(ssoProviders.id, id));
    res.json({ success: true, message: 'SSO provider deleted' });
  } catch (error) {
    console.error('Error deleting SSO provider:', error);
    res.status(500).json({ error: 'Failed to delete SSO provider' });
  }
});

router.get('/login/:providerId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { providerId } = req.params;
    
    const [provider] = await db.select()
      .from(ssoProviders)
      .where(eq(ssoProviders.id, providerId));
    
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }
    
    if (!provider.active) {
      res.status(400).json({ error: 'SSO provider is disabled' });
      return;
    }
    
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    
    if (provider.type === 'oidc') {
      const authUrl = new URL(`${provider.issuer}/authorize`);
      authUrl.searchParams.set('client_id', provider.clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email');
      authUrl.searchParams.set('redirect_uri', provider.callbackUrl || '');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', nonce);
      
      res.json({
        redirectUrl: authUrl.toString(),
        state,
        nonce,
        message: 'Redirect user to this URL for SSO login',
      });
    } else if (provider.type === 'saml') {
      res.json({
        message: 'SAML SSO stub - redirect to IdP',
        metadataUrl: provider.metadataUrl,
        state,
        hint: 'Implement SAML request generation for production',
      });
    } else {
      res.status(400).json({ error: 'Unsupported SSO type' });
    }
  } catch (error) {
    console.error('Error initiating SSO login:', error);
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

router.post('/callback', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code, state, providerId, wallet } = req.body;
    
    if (!code || !state || !providerId || !wallet) {
      res.status(400).json({ error: 'Missing required callback parameters' });
      return;
    }
    
    const [provider] = await db.select()
      .from(ssoProviders)
      .where(eq(ssoProviders.id, providerId));
    
    if (!provider) {
      res.status(404).json({ error: 'SSO provider not found' });
      return;
    }
    
    const subject = `oidc|${provider.issuer}|${randomBytes(16).toString('hex')}`;
    
    const [identity] = await db.insert(ssoIdentities).values({
      tenantId: provider.tenantId,
      subject,
      wallet,
      roles: { default: ['user'] },
    }).returning();
    
    res.json({
      success: true,
      identity: {
        id: identity.id,
        subject: identity.subject,
        wallet: identity.wallet,
        roles: identity.roles,
      },
      message: 'SSO identity linked - stub implementation',
    });
  } catch (error) {
    console.error('Error processing SSO callback:', error);
    res.status(500).json({ error: 'Failed to process SSO callback' });
  }
});

router.get('/identities', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.query.tenantId as string || req.tenantId;
    
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant ID required' });
      return;
    }
    
    const identities = await db.select()
      .from(ssoIdentities)
      .where(eq(ssoIdentities.tenantId, tenantId));
    
    res.json({ identities });
  } catch (error) {
    console.error('Error fetching SSO identities:', error);
    res.status(500).json({ error: 'Failed to fetch SSO identities' });
  }
});

router.delete('/identities/:id', requireAdminWallet, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.delete(ssoIdentities).where(eq(ssoIdentities.id, id));
    res.json({ success: true, message: 'SSO identity unlinked' });
  } catch (error) {
    console.error('Error deleting SSO identity:', error);
    res.status(500).json({ error: 'Failed to delete SSO identity' });
  }
});

export default router;
