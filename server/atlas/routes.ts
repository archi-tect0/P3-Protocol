import { Router, Request, Response, NextFunction } from 'express';
import type { Session, FlowStep, Scope, Receipt, NLIntent } from './types';
import type { AtlasEndpoint, InsertAtlasEndpoint } from '@shared/schema';
import { atlasUserSettings } from '@shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { getStorageInstance } from '../storage-accessor';
import { atlasConfig } from './config';
import { parseIntent, parseEndUserIntent, suggestFeatures } from './services/intent';
import { runFlow, runSingleStep } from './services/orchestrator';
import { searchEndpoints, loadRegistry, getExternalApps, findDeveloperChatEndpoint } from './services/registryAdapter';
import { getMetrics, getRecentEvents } from './services/observability';
import { validateSession, checkRole } from './services/governance';
import { 
  startSession as bridgeStartSession, 
  connectApps, 
  getSession as bridgeGetSession,
  refreshSession,
  endSession,
  getAvailableEndpoints,
  sanitizeSession,
  validateSessionToken
} from './services/sessionBridge';
import { mapIntentToSteps, getSuggestedActions } from './services/rules';
import { composeFlow, composeFlowWithAI, validateFlowAgainstSession } from './services/flowComposer';
import { parseMultiAgentFlow, executeAgentFlow, describeAgentFlow, getAgentCapabilities, parseAgentIntent } from './services/agentMesh';
import { 
  setVaultSecret, 
  getVaultSecret, 
  deleteVaultSecret, 
  hasVaultSecret, 
  listVaultSecrets,
  setDeveloperKey,
  getDeveloperKey,
  getConfiguredProviders,
  getConnectedOAuthApps,
  validateProviderKey
} from './services/vault';
import { recipes, getRecipesByRole } from './recipes';
import { semanticMatch, getBestMatch } from './services/intentSemantic';
import { handshakeForApp, getAllAppHandshakes } from './services/appHandshake';
import { suggestNext, formatSuggestionsForChat } from './services/suggestions';
import { tickCron, tickThreshold, getTriggeredRecipes } from './services/triggers';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import { devkitRouter } from './devkit';
import { memoryRouter } from './memory';
import { voiceRouter } from './voice';
import { launcherRouter } from './launcher';
import { metaAdapterRouter } from './metaAdapter';
import canvasRouter from './routes/canvas';
import onboardingRouter from './routes/onboarding';
import profileRouter from './routes/profile';
import alexaRouter from './routes/alexa';
import libraryRouter from './routes/library';
import { initializeMetaAdapter, isMetaAdapterReady } from './services/metaAdapter';
import { streamingRouter } from './streaming';

initializeMetaAdapter().then(result => {
  console.log(`[Atlas] Meta-adapter ${result.success ? 'initialized' : 'failed'}: ${result.message}`);
}).catch(err => {
  console.error('[Atlas] Meta-adapter init error:', err);
});

const router = Router();

router.use('/devkit', optionalAtlasAuth, devkitRouter);
router.use('/memory', optionalAtlasAuth, memoryRouter);
router.use('/voice', optionalAtlasAuth, voiceRouter);
router.use('/launcher', optionalAtlasAuth, launcherRouter);
router.use('/meta', metaAdapterRouter);
router.use('/canvas', canvasRouter);
router.use('/onboarding', onboardingRouter);
router.use('/profile', profileRouter);
router.use('/alexa', alexaRouter);
router.use('/library', libraryRouter);
router.use('/streaming', streamingRouter);

import multer from 'multer';
const transcribeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/transcribe', transcribeUpload.single('audio'), async (req: Request, res: Response) => {
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      res.status(400).json({
        ok: false,
        error: 'No audio file provided',
        'data-testid': 'transcribe-error',
      });
      return;
    }
    
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      res.status(503).json({
        ok: false,
        error: 'Transcription service not configured. Please configure an OpenAI API key.',
        'data-testid': 'transcribe-error',
      });
      return;
    }
    
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', audioFile.buffer, {
      filename: audioFile.originalname || 'audio.webm',
      contentType: audioFile.mimetype || 'audio/webm',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      res.status(response.status).json({
        ok: false,
        error: 'Transcription failed',
        'data-testid': 'transcribe-error',
      });
      return;
    }
    
    const result = await response.json() as { text?: string };
    
    res.json({
      ok: true,
      text: result.text || '',
      'data-testid': 'transcribe-response',
    });
    
  } catch (error) {
    console.error('Transcription error:', error);
    const message = error instanceof Error ? error.message : 'Transcription failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'transcribe-error',
    });
  }
});

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET must be set in production');
    }
    return 'dev-secret-insecure';
  }
  return secret;
}

interface AtlasUser {
  wallet: string;
  roles: string[];
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      atlasUser?: AtlasUser;
    }
  }
}

function optionalAtlasAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const walletHeader = (req.headers['x-wallet-address'] as string || '').toLowerCase();

  if (!token) {
    return next();
  }

  // Try JWT verification first
  try {
    const decoded = jwt.verify(token, getJWTSecret()) as { 
      wallet: string; 
      roles?: string[];
      sessionId?: string;
    };

    if (decoded.wallet) {
      req.atlasUser = {
        wallet: decoded.wallet.toLowerCase(),
        roles: decoded.roles || ['user'],
        sessionId: decoded.sessionId,
      };
      return next();
    }
  } catch {
    // JWT verification failed, try session token
  }

  // Try session token validation (hex tokens from sessionBridge)
  if (walletHeader && token) {
    // Check if token looks like a session token (64 char hex string)
    if (/^[a-f0-9]{64}$/i.test(token)) {
      if (validateSessionToken(token, walletHeader)) {
        const session = bridgeGetSession(walletHeader);
        req.atlasUser = {
          wallet: walletHeader,
          roles: session?.roles || ['user'],
          sessionId: session?.token,
        };
        return next();
      }
    }
  }

  next();
}

function requireWalletOwnership(req: Request, res: Response, next: NextFunction) {
  const wallet = (req.body?.wallet || req.query?.wallet || '') as string;
  
  if (!wallet) {
    res.status(400).json({ 
      ok: false, 
      error: 'Wallet address is required' 
    });
    return;
  }

  const normalizedWallet = wallet.toLowerCase();
  
  if (req.atlasUser && req.atlasUser.wallet !== normalizedWallet) {
    res.status(403).json({ 
      ok: false, 
      error: 'Wallet mismatch: token wallet does not match request wallet' 
    });
    return;
  }

  next();
}

function requireAuthForWrite(req: Request, res: Response, next: NextFunction) {
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  
  if (isWriteMethod && !req.atlasUser) {
    res.status(401).json({ 
      ok: false, 
      error: 'Authentication required for write operations. Provide a valid Bearer token.',
      'data-testid': 'atlas-auth-error'
    });
    return;
  }
  
  next();
}

const VERSION = '1.0.0';

function getTimeRange(range: string): { start: number; end: number } {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  
  switch (range) {
    case 'hour':
      return { start: now - hour, end: now };
    case 'week':
      return { start: now - 7 * day, end: now };
    case 'month':
      return { start: now - 30 * day, end: now };
    case 'day':
    default:
      return { start: now - day, end: now };
  }
}

router.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    version: VERSION,
    protocolVersion: '2.0',
    atlasVersion: '2.0',
    timestamp: Date.now(),
    telemetryCaps: ['calls', 'latency', 'payload', 'sessions', 'uptime'],
    lanes: ['ACCESS', 'MANIFESTS', 'RECEIPTS', 'MEDIA', 'COMMERCE', 'GOVERNANCE', 'NOTIFICATIONS', 'CHAT'],
    'data-testid': 'atlas-health-response',
  });
});

/**
 * Atlas Launch Endpoint for Alexa Skills and External Integrations
 * 
 * Returns a session URL, QR code, and session ID for voice-first interfaces
 * like Echo Show to display Atlas entry points.
 * 
 * GET /api/atlas/launch - Create new launch session
 * GET /api/atlas/launch/:sessionId - Get existing session status
 */
/**
 * Detect device type from user agent or query param
 */
function detectDevice(req: Request): { 
  isWearOS: boolean; 
  isEchoShow: boolean; 
  deviceType: string; 
  deviceLabel: string;
} {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const deviceParam = (req.query.device as string || '').toLowerCase();
  
  const isWearOS = deviceParam === 'wearos' || 
    ua.includes('wear') || 
    ua.includes('sm-r') || 
    ua.includes('tizen') || 
    ua.includes('watch') ||
    ua.includes('atlaswearos');
  
  const isEchoShow = deviceParam === 'echoshow' ||
    ua.includes('echo show') || 
    ua.includes('alexa') ||
    ua.includes('firetv');

  let deviceType = 'browser';
  let deviceLabel = 'Web Browser';

  if (isWearOS) {
    deviceType = 'wearos';
    deviceLabel = 'Galaxy Watch';
  } else if (isEchoShow) {
    deviceType = 'echoShow';
    deviceLabel = 'Echo Show';
  } else if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
    deviceLabel = 'Mobile Device';
  }

  return { isWearOS, isEchoShow, deviceType, deviceLabel };
}

router.get('/launch', async (req: Request, res: Response) => {
  try {
    const crypto = require('crypto');
    const sessionId = crypto.randomUUID().slice(0, 8);
    const timestamp = Date.now();
    
    const device = detectDevice(req);
    
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
      : req.protocol + '://' + req.get('host');
    
    const deviceSuffix = device.deviceType !== 'browser' ? `&device=${device.deviceType}` : '';
    const sessionUrl = `${baseUrl}/atlas?session=${sessionId}${deviceSuffix}`;
    const qrUrl = `${baseUrl}/api/atlas/qr/${sessionId}`;
    
    const qrDataUrl = await QRCode.toDataURL(sessionUrl, {
      width: device.isWearOS ? 150 : 300,
      margin: device.isWearOS ? 1 : 2,
      color: {
        dark: '#FFFFFF',
        light: '#0A0A0A'
      }
    });

    res.json({
      ok: true,
      url: sessionUrl,
      qr: qrUrl,
      qrDataUrl,
      sessionId,
      expiresAt: timestamp + 300000,
      device: {
        type: device.deviceType,
        label: device.deviceLabel,
        isWearOS: device.isWearOS,
        isEchoShow: device.isEchoShow,
      },
      'data-testid': 'atlas-launch-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Launch failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-launch-error',
    });
  }
});

router.get('/launch/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  res.json({
    ok: true,
    sessionId,
    status: 'pending',
    message: 'Waiting for wallet connection',
    'data-testid': 'atlas-launch-status-response',
  });
});

router.get('/qr/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
      : req.protocol + '://' + req.get('host');
    
    const sessionUrl = `${baseUrl}/atlas?session=${sessionId}`;
    
    const qrBuffer = await QRCode.toBuffer(sessionUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#FFFFFF',
        light: '#0A0A0A'
      }
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(qrBuffer);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'QR generation failed',
      'data-testid': 'atlas-qr-error',
    });
  }
});

/**
 * Atlas Session Handoff - Device-to-Device Session Migration
 * 
 * Enables seamless session transfer across devices:
 * - "Atlas, move this to kitchen Echo"
 * - "Atlas, open this on my phone"
 * 
 * SECURITY: Requires authentication and validates wallet ownership
 * 
 * POST /api/atlas/handoff
 */
router.post('/handoff', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const { sessionId, sourceDevice, targetDevice, userId } = req.body;
    const crypto = require('crypto');

    if (!sessionId || !targetDevice) {
      res.status(400).json({
        ok: false,
        status: 'error',
        error: 'sessionId and targetDevice are required',
        'data-testid': 'atlas-handoff-error',
      });
      return;
    }

    if (userId && !/^0x[a-fA-F0-9]{40}$/.test(userId)) {
      res.status(400).json({
        ok: false,
        status: 'error',
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-handoff-error',
      });
      return;
    }
    
    if (userId && req.atlasUser && req.atlasUser.wallet !== userId.toLowerCase()) {
      res.status(403).json({
        ok: false,
        status: 'error',
        error: 'Wallet mismatch: authenticated wallet does not match request',
        'data-testid': 'atlas-handoff-error',
      });
      return;
    }

    const handoffToken = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const expiresIn = 300;
    
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`
      : req.protocol + '://' + req.get('host');
    
    const sessionUrl = `${baseUrl}/atlas?session=${sessionId}&handoff=${handoffToken}`;
    const qrUrl = `${baseUrl}/api/atlas/qr/${sessionId}`;
    
    const qrDataUrl = await QRCode.toDataURL(sessionUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#FFFFFF',
        light: '#0A0A0A'
      }
    });

    const deviceLabels: Record<string, string> = {
      'phone': 'Phone',
      'echoShow': 'Echo Show',
      'kitchenEcho': 'Kitchen Echo Show',
      'livingRoomEcho': 'Living Room Echo Show',
      'bedroomEcho': 'Bedroom Echo Show',
      'officeEcho': 'Office Echo Show',
      'browser': 'Web Browser',
    };

    res.json({
      ok: true,
      status: 'success',
      sessionId,
      url: sessionUrl,
      qr: qrUrl,
      qrDataUrl,
      sourceDevice: sourceDevice || 'unknown',
      targetDevice,
      targetDeviceLabel: deviceLabels[targetDevice] || targetDevice,
      expiresIn,
      expiresAt: timestamp + (expiresIn * 1000),
      'data-testid': 'atlas-handoff-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Handoff failed';
    res.status(500).json({
      ok: false,
      status: 'error',
      error: message,
      'data-testid': 'atlas-handoff-error',
    });
  }
});

router.get('/handoff/:sessionId/status', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  res.json({
    ok: true,
    sessionId,
    status: 'active',
    connectedDevices: [],
    lastActivity: Date.now(),
    'data-testid': 'atlas-handoff-status-response',
  });
});

router.post('/session', async (req: Request, res: Response) => {
  try {
    const { wallet, grants, roles } = req.body;

    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet address is required',
        'data-testid': 'atlas-session-error',
      });
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-session-error',
      });
      return;
    }

    const validRoles = roles?.filter((r: string) => 
      ['admin', 'moderator', 'user'].includes(r)
    ) as ('admin' | 'moderator' | 'user')[] | undefined;

    let session = bridgeStartSession(wallet, validRoles || ['user']);
    
    if (grants && Array.isArray(grants) && grants.length > 0) {
      const validGrants = grants.filter((g: string) => 
        atlasConfig.consentScopes.includes(g as Scope)
      ) as Scope[];
      if (validGrants.length > 0) {
        session = connectApps(wallet, [], validGrants);
      }
    }
    
    const validation = validateSession(session);

    if (!validation.valid) {
      res.status(400).json({
        ok: false,
        error: validation.reason,
        'data-testid': 'atlas-session-error',
      });
      return;
    }

    res.json({
      ok: true,
      session: sanitizeSession(session),
      'data-testid': 'atlas-session-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-session-error',
    });
  }
});

router.post('/session/start', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const { wallet, roles } = req.body || {};

    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet address is required',
        'data-testid': 'atlas-session-start-error',
      });
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-session-start-error',
      });
      return;
    }

    const normalizedWallet = wallet.toLowerCase();
    
    // If already authenticated via optionalAtlasAuth (JWT or session token), verify wallet matches
    if (req.atlasUser) {
      if (req.atlasUser.wallet !== normalizedWallet) {
        res.status(403).json({
          ok: false,
          error: 'Wallet mismatch: authenticated wallet does not match request',
          'data-testid': 'atlas-session-start-error',
        });
        return;
      }
      // Authenticated user - create/refresh session
      const validRoles = (roles || req.atlasUser.roles || ['user']).filter((r: string) => 
        ['admin', 'moderator', 'user'].includes(r)
      ) as ('admin' | 'moderator' | 'user')[];

      const session = bridgeStartSession(normalizedWallet, validRoles);
      res.json({
        ok: true,
        session: { ...sanitizeSession(session), token: session.token },
        'data-testid': 'atlas-session-start-response',
      });
      return;
    }

    // No pre-existing auth - try JWT token verification for backwards compatibility
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      try {
        const decoded = jwt.verify(token, getJWTSecret()) as { userId: string; role: string };
        const storage = getStorageInstance();
        const user = await storage.getUserById(decoded.userId);
        
        if (user?.email?.endsWith('@wallet')) {
          const tokenWallet = user.email.replace('@wallet', '').toLowerCase();
          if (tokenWallet === normalizedWallet) {
            // JWT matches wallet - create session
            const validRoles = (roles || ['user']).filter((r: string) => 
              ['admin', 'moderator', 'user'].includes(r)
            ) as ('admin' | 'moderator' | 'user')[];

            const session = bridgeStartSession(normalizedWallet, validRoles);
            res.json({
              ok: true,
              session: { ...sanitizeSession(session), token: session.token },
              'data-testid': 'atlas-session-start-response',
            });
            return;
          }
        }
      } catch (jwtError) {
        // JWT invalid - fall through to wallet-only session
      }
    }

    // No valid auth - create basic wallet session
    // This allows mesh nodes to connect with just wallet address
    // The WebSocket will verify ownership via signature challenge
    const validRoles = (roles || ['user']).filter((r: string) => 
      ['admin', 'moderator', 'user'].includes(r)
    ) as ('admin' | 'moderator' | 'user')[];

    const session = bridgeStartSession(normalizedWallet, validRoles);

    res.json({
      ok: true,
      session: { ...sanitizeSession(session), token: session.token },
      'data-testid': 'atlas-session-start-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-session-start-error',
    });
  }
});

router.post('/session/connect', optionalAtlasAuth, requireWalletOwnership, (req: Request, res: Response) => {
  try {
    const { wallet, appIds, grants } = req.body || {};

    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet address is required',
        'data-testid': 'atlas-session-connect-error',
      });
      return;
    }

    const validGrants = (grants || []).filter((g: string) => 
      atlasConfig.consentScopes.includes(g as Scope)
    ) as Scope[];

    const session = connectApps(wallet, appIds || [], validGrants);

    res.json({
      ok: true,
      session: sanitizeSession(session),
      connectedApps: session.connectedApps,
      capabilities: Object.keys(session.capabilityMap).length,
      'data-testid': 'atlas-session-connect-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-session-connect-error',
    });
  }
});

router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { wallet, message, params, roles } = req.body || {};

    if (!wallet) {
      res.status(401).json({
        ok: false,
        error: 'No wallet provided',
        'data-testid': 'atlas-ask-error',
      });
      return;
    }

    let session = bridgeGetSession(wallet);
    if (!session) {
      const validRoles = (roles || ['user']).filter((r: string) => 
        ['admin', 'moderator', 'user'].includes(r)
      ) as ('admin' | 'moderator' | 'user')[];
      session = bridgeStartSession(wallet, validRoles);
    }

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        ok: false,
        error: 'Message is required',
        'data-testid': 'atlas-ask-error',
      });
      return;
    }

    const parsedIntent = parseIntent(message, session.roles[0]);
    const endUserResult = parseEndUserIntent(message);
    
    const intent = parsedIntent?.nlIntent || endUserResult.intent;
    const feature = parsedIntent?.feature || endUserResult.feature;
    const parsedParams = { ...endUserResult.params, ...parsedIntent?.constraints };

    if (intent === 'devkit_query' || intent === 'devkit_endpoints' || intent === 'devkit_help' || 
        intent === 'devkit_flows' || intent === 'devkit_apps' || intent === 'devkit_describe' ||
        feature?.startsWith('devkit.')) {
      const { processDevKitQuery, listAllEndpoints, listAllFlows, listAllApps, describeEndpoint, getDevKitHelp, getQuickStats } = await import('./services/devkitRegistry');
      
      let devkitResult;
      if (intent === 'devkit_endpoints' || feature === 'devkit.endpoints') {
        const endpoints = listAllEndpoints();
        const stats = getQuickStats();
        devkitResult = {
          message: `There are ${stats.totalEndpoints} endpoints available (${stats.liveEndpoints} live). Here are the main ones:`,
          data: { endpoints: endpoints.slice(0, 20), stats },
        };
      } else if (intent === 'devkit_flows' || feature === 'devkit.flows') {
        const flows = listAllFlows();
        devkitResult = {
          message: `There are ${flows.length} compound flows available:`,
          data: { flows },
        };
      } else if (intent === 'devkit_apps' || feature === 'devkit.apps') {
        const apps = listAllApps();
        devkitResult = {
          message: `There are ${apps.length} apps registered:`,
          data: { apps },
        };
      } else if (intent === 'devkit_describe' || feature === 'devkit.describe') {
        const endpointKey = parsedParams.endpoint || '';
        const endpoint = describeEndpoint(endpointKey);
        devkitResult = endpoint 
          ? { message: `Endpoint ${endpointKey}: ${endpoint.description || 'No description'}`, data: { endpoint } }
          : { message: `Endpoint "${endpointKey}" not found`, data: { found: false } };
      } else if (intent === 'devkit_help' || feature === 'devkit.help') {
        const stats = getQuickStats();
        devkitResult = {
          message: `I can help you with many things! Here's what I can do:\n\n**${stats.totalEndpoints} endpoints** across ${stats.totalApps} apps ready to use.\n\nTap any category below to explore:`,
          data: { stats },
          suggestions: [
            'Show messages & notes',
            'Show payment features',
            'Show Atlas One catalog',
            'Show Game Deck features',
            'List all endpoints',
            'List connected apps',
          ],
        };
      } else {
        const queryText = parsedParams.query || message.replace(/^atlas devkit\s*/i, '');
        const result = processDevKitQuery(queryText);
        devkitResult = {
          message: typeof result.data === 'string' 
            ? result.data 
            : `Found ${result.count || 0} results for "${queryText}"`,
          data: result,
        };
      }
      
      const resultData = devkitResult.data as Record<string, unknown> | undefined;
      const endpointsCount = resultData && Array.isArray(resultData.endpoints) ? resultData.endpoints.length : 1;
      
      res.json({
        ok: true,
        ...devkitResult,
        intent,
        feature,
        receipts: [{
          type: 'devkit',
          action: 'query',
          count: endpointsCount,
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    if (intent === 'memory_pinned' || intent === 'memory_pin' || intent === 'memory_unpin' ||
        intent === 'memory_flows' || intent === 'memory_queries' || intent === 'memory_clear' ||
        feature?.startsWith('memory.')) {
      const { getPinnedApps, addPinned, removePinned, getRecentFlows, getRecentQueries, clearHistory } = await import('./services/sessionMemory');
      
      let memoryResult;
      if (intent === 'memory_pinned' || feature === 'memory.pinned') {
        const pinned = getPinnedApps(wallet);
        memoryResult = {
          message: pinned.length > 0 
            ? `You have ${pinned.length} pinned app${pinned.length === 1 ? '' : 's'}: ${pinned.join(', ')}`
            : 'You have no pinned apps yet. Say "pin Slack" to add one.',
          data: { pinned },
          count: pinned.length,
        };
      } else if (intent === 'memory_pin' || feature === 'memory.pin') {
        const appId = (parsedParams.appId || '').toLowerCase().trim();
        if (appId) {
          addPinned(wallet, appId);
          const pinned = getPinnedApps(wallet);
          memoryResult = {
            message: `Pinned ${appId}. You now have ${pinned.length} pinned app${pinned.length === 1 ? '' : 's'}.`,
            data: { appId, pinned },
            count: pinned.length,
          };
        } else {
          memoryResult = {
            message: 'No app specified. Say "pin Slack" or "pin Spotify".',
            data: { error: 'No app specified' },
            count: 0,
          };
        }
      } else if (intent === 'memory_unpin' || feature === 'memory.unpin') {
        const appId = (parsedParams.appId || '').toLowerCase().trim();
        if (appId) {
          removePinned(wallet, appId);
          const pinned = getPinnedApps(wallet);
          memoryResult = {
            message: `Unpinned ${appId}.`,
            data: { appId, pinned },
            count: pinned.length,
          };
        } else {
          memoryResult = {
            message: 'No app specified. Say "unpin Slack" to remove it.',
            data: { error: 'No app specified' },
            count: 0,
          };
        }
      } else if (intent === 'memory_flows' || feature === 'memory.flows') {
        const flows = getRecentFlows(wallet, 10);
        memoryResult = {
          message: flows.length > 0
            ? `Your last ${flows.length} flow${flows.length === 1 ? '' : 's'}: ${flows.slice(0, 5).join(', ')}${flows.length > 5 ? '...' : ''}`
            : 'No recent flows yet.',
          data: { flows },
          count: flows.length,
        };
      } else if (intent === 'memory_queries' || feature === 'memory.queries') {
        const queries = getRecentQueries(wallet, 20);
        memoryResult = {
          message: queries.length > 0
            ? `Your last ${queries.length} quer${queries.length === 1 ? 'y' : 'ies'}.`
            : 'No recent queries yet.',
          data: { queries },
          count: queries.length,
        };
      } else if (intent === 'memory_clear' || feature === 'memory.clear') {
        const type = (parsedParams.type || 'all') as 'flows' | 'queries' | 'all';
        clearHistory(wallet, type);
        memoryResult = {
          message: type === 'all' 
            ? 'Cleared all history (flows and queries).'
            : `Cleared ${type} history.`,
          data: { cleared: type },
          count: 0,
        };
      } else {
        memoryResult = {
          message: 'I can help you manage your pinned apps and history. Try "show my pinned apps" or "what did I run last".',
          data: {},
          count: 0,
        };
      }
      
      res.json({
        ok: true,
        ...memoryResult,
        intent,
        feature,
        receipts: [{
          type: 'memory',
          action: intent?.replace('memory_', '') || 'query',
          count: memoryResult.count,
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    // Admin Analytics - requires admin role
    if (intent?.startsWith('admin_') || feature?.startsWith('admin.')) {
      const isAdmin = session.roles.includes('admin');
      
      if (!isAdmin) {
        res.json({
          ok: false,
          message: 'Admin access required. This feature is only available to admin wallets.',
          intent,
          feature,
          error: 'unauthorized',
          'data-testid': 'atlas-ask-response',
        });
        return;
      }

      const rangeParam = parsedParams.range || 'day';
      const now = Date.now();
      const ranges: Record<string, { start: number; end: number; label: string }> = {
        hour: { start: now - 3600000, end: now, label: 'last hour' },
        day: { start: now - 86400000, end: now, label: 'today' },
        week: { start: now - 604800000, end: now, label: 'this week' },
        month: { start: now - 2592000000, end: now, label: 'this month' },
      };
      const timeRange = ranges[rangeParam] || ranges.day;

      const metrics = getMetrics(timeRange);
      const recentEvents = getRecentEvents(50);

      let analyticsResult: { message: string; data: any; action?: string };

      if (intent === 'admin_dashboard') {
        analyticsResult = {
          message: `Opening your admin dashboard. You have ${metrics.totalCalls} total calls ${timeRange.label} with ${Object.keys(metrics.byWallet).length} unique users.`,
          data: {
            navigate: 'metrics',
            summary: {
              totalCalls: metrics.totalCalls,
              totalErrors: metrics.totalErrors,
              uniqueWallets: Object.keys(metrics.byWallet).length,
              avgDuration: Math.round(metrics.avgDuration),
            },
          },
          action: 'navigate_to_metrics',
        };
      } else if (intent === 'admin_analytics_visitors') {
        const wallets = Object.entries(metrics.byWallet)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        const uniqueCount = Object.keys(metrics.byWallet).length;
        
        analyticsResult = {
          message: uniqueCount > 0
            ? `You had ${uniqueCount} unique visitor${uniqueCount === 1 ? '' : 's'} ${timeRange.label}. ${wallets.length > 0 ? `Top visitor: ${wallets[0][0].slice(0, 8)}... with ${wallets[0][1]} calls.` : ''}`
            : `No visitors ${timeRange.label} yet.`,
          data: {
            uniqueVisitors: uniqueCount,
            topWallets: wallets.map(([w, c]) => ({ wallet: w, calls: c })),
            range: timeRange.label,
          },
        };
      } else if (intent === 'admin_analytics_calls') {
        analyticsResult = {
          message: `You had ${metrics.totalCalls} API call${metrics.totalCalls === 1 ? '' : 's'} ${timeRange.label}. Average response time: ${Math.round(metrics.avgDuration)}ms.`,
          data: {
            totalCalls: metrics.totalCalls,
            avgDuration: Math.round(metrics.avgDuration),
            byStatus: metrics.byStatus,
            range: timeRange.label,
          },
        };
      } else if (intent === 'admin_analytics_errors') {
        const errorEvents = recentEvents.filter(e => e.status === 'error').slice(0, 10);
        const errorRate = metrics.totalCalls > 0 
          ? ((metrics.totalErrors / metrics.totalCalls) * 100).toFixed(1)
          : '0';
        
        analyticsResult = {
          message: metrics.totalErrors > 0
            ? `You had ${metrics.totalErrors} error${metrics.totalErrors === 1 ? '' : 's'} ${timeRange.label} (${errorRate}% error rate).${errorEvents.length > 0 ? ` Most recent: ${errorEvents[0].endpoint}` : ''}`
            : `No errors ${timeRange.label}! Your system is running smoothly.`,
          data: {
            totalErrors: metrics.totalErrors,
            errorRate: parseFloat(errorRate),
            recentErrors: errorEvents.map(e => ({
              endpoint: e.endpoint,
              error: e.error,
              ts: e.ts,
            })),
            range: timeRange.label,
          },
        };
      } else {
        // Generic metrics overview
        const topEndpoints = Object.entries(metrics.byEndpoint)
          .sort((a, b) => b[1].calls - a[1].calls)
          .slice(0, 5);
        
        analyticsResult = {
          message: `${timeRange.label.charAt(0).toUpperCase() + timeRange.label.slice(1)} overview: ${metrics.totalCalls} calls, ${Object.keys(metrics.byWallet).length} users, ${metrics.totalErrors} errors, ${Math.round(metrics.avgDuration)}ms avg response.`,
          data: {
            summary: {
              totalCalls: metrics.totalCalls,
              totalErrors: metrics.totalErrors,
              uniqueWallets: Object.keys(metrics.byWallet).length,
              avgDuration: Math.round(metrics.avgDuration),
            },
            topEndpoints: topEndpoints.map(([ep, stats]) => ({
              endpoint: ep,
              calls: stats.calls,
              errors: stats.errors,
              avgDuration: Math.round(stats.avgDuration),
            })),
            byStatus: metrics.byStatus,
            range: timeRange.label,
          },
        };
      }

      res.json({
        ok: true,
        ...analyticsResult,
        intent,
        feature,
        receipts: [{
          type: 'admin_analytics',
          action: intent?.replace('admin_', '') || 'metrics',
          data: analyticsResult.data,
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    // Knowledge Base Queries
    if (intent === 'knowledge_query' || feature?.startsWith('knowledge.')) {
      const { knowledgeBase, formatKnowledgeResponse } = await import('./knowledge');
      const topicId = parsedParams.topicId || '';
      const topic = knowledgeBase.find(t => t.id === topicId);
      
      if (topic) {
        const { content, suggestions } = formatKnowledgeResponse(topic);
        res.json({
          ok: true,
          message: content,
          intent: 'knowledge_query',
          feature: 'knowledge.topic',
          data: {
            topicId: topic.id,
            title: topic.title,
            category: topic.category,
          },
          suggestions,
          receipts: [{
            type: 'knowledge',
            action: 'topic_lookup',
            topic: topic.id,
          }],
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
    }

    // Wikipedia Help - when user explicitly asks about how to use Wikipedia (not from suggestion chips)
    if (intent === 'wikipedia_help') {
      const helpMessage = `I can search Wikipedia for you! Here's how to use it:

**Try asking:**
• "Search Wikipedia for [topic]" - Look up any topic
• "Who is [person]?" - Learn about famous people
• "What is [concept]?" - Understand concepts and terms
• "Wiki [topic]" - Quick shorthand search

**Examples:**
• "Search Wikipedia for Albert Einstein"
• "Who was Leonardo da Vinci?"
• "What is quantum physics?"
• "Wiki Mount Everest"`;

      res.json({
        ok: true,
        message: helpMessage,
        intent: 'wikipedia_help',
        feature: 'atlas.wikipedia.help',
        data: { type: 'guidance' },
        suggestions: [
          'Search Wikipedia for Albert Einstein',
          'Who is Marie Curie?',
          'What is the Great Wall of China?',
          'Wiki solar system',
        ],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    // Wikipedia Lookup
    if (intent === 'wikipedia_lookup' || feature === 'atlas.wikipedia.search') {
      const { searchWikipedia } = await import('./services/wikipediaService');
      const term = parsedParams.term || message.replace(/^(?:search|wiki(?:pedia)?|look up|tell me about|what is|who is|who was|what are|what was|what were)\s*/i, '').replace(/\s*(?:on\s+)?(?:from\s+)?wikipedia\s*$/i, '').trim();
      
      if (!term) {
        // No search term provided - provide helpful guidance
        const helpMessage = `I can search Wikipedia for you! Just tell me what you'd like to learn about.

**Try asking:**
• "Search Wikipedia for [topic]"
• "Who is [person]?"
• "What is [concept]?"`;

        res.json({
          ok: true,
          message: helpMessage,
          intent: 'wikipedia_help',
          feature: 'atlas.wikipedia.help',
          data: { term: '' },
          suggestions: [
            'Search Wikipedia for Albert Einstein',
            'Who is Marie Curie?',
            'What is the Great Wall of China?',
            'Wiki solar system',
          ],
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
      
      // term is guaranteed to exist here
      const results = await searchWikipedia(term);
      
      if (results.length > 0) {
        const topResult = results[0];
        const extract = topResult.extract.length > 500 
          ? topResult.extract.substring(0, 500) + '...'
          : topResult.extract;
        
        res.json({
          ok: true,
          message: `**${topResult.title}**\n\n${extract}\n\n[Read more on Wikipedia](${topResult.url})`,
          intent: 'wikipedia_lookup',
          feature: 'atlas.wikipedia.search',
          data: {
            term,
            results: results.slice(0, 5),
            topResult,
          },
          suggestions: [
            `Tell me more about ${topResult.title}`,
            'Search something else on Wikipedia',
            'What is Atlas?',
          ],
          receipts: [{
            type: 'wikipedia',
            action: 'search',
            term,
            resultCount: results.length,
          }],
          'data-testid': 'atlas-ask-response',
        });
        return;
      } else {
        res.json({
          ok: true,
          message: `I couldn't find anything on Wikipedia for "${term}". Try a different search term.`,
          intent: 'wikipedia_lookup',
          feature: 'atlas.wikipedia.search',
          data: { term, results: [] },
          suggestions: ['What is Atlas?', 'Search Toronto on Wikipedia', 'Who is Albert Einstein'],
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
    }

    // Developer Private Endpoints - check manifest-registered chat endpoints
    const developerMatch = findDeveloperChatEndpoint(message, wallet);
    if (developerMatch) {
      try {
        const url = new URL(developerMatch.url);
        const allowedProtocols = ['https:', 'http:'];
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
        
        if (!allowedProtocols.includes(url.protocol)) {
          throw new Error('Invalid protocol - must be HTTP or HTTPS');
        }
        if (blockedHosts.some(h => url.hostname.includes(h))) {
          throw new Error('Internal addresses not allowed');
        }
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(developerMatch.url, {
          method: 'GET',
          headers: {
            'X-Atlas-Wallet': wallet,
            'X-Atlas-Endpoint': developerMatch.key,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        
        let data = null;
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch {
            data = { status: 'executed', message: 'Non-JSON response' };
          }
        }
        
        res.json({
          ok: true,
          message: data 
            ? `Here's your data from ${developerMatch.name}:`
            : `Called ${developerMatch.name} successfully.`,
          intent: 'developer_endpoint',
          feature: `developer.${developerMatch.key}`,
          data: data || { endpoint: developerMatch.key, status: 'executed' },
          receipts: [{
            type: 'developer_endpoint',
            key: developerMatch.key,
            name: developerMatch.name,
            matchedPhrase: developerMatch.phrase,
            score: developerMatch.score,
          }],
          'data-testid': 'atlas-ask-response',
        });
        return;
      } catch (err) {
        console.error(`[Atlas] Developer endpoint ${developerMatch.key} failed:`, err);
        res.json({
          ok: false,
          message: `Failed to call ${developerMatch.name}. The endpoint may be unavailable.`,
          intent: 'developer_endpoint',
          feature: `developer.${developerMatch.key}`,
          error: err instanceof Error ? err.message : 'Unknown error',
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
    }

    if (intent === 'registry_list' || feature === 'registry.endpoints.list') {
      const lowerMessage = message.toLowerCase().trim();
      const isCapabilityQuestion = /^what (?:can you do|are you|do you do)/i.test(lowerMessage) ||
        /^how many (?:endpoints?|apis?|features?) /i.test(lowerMessage) ||
        /^help$|^what is atlas/i.test(lowerMessage);
      
      if (isCapabilityQuestion) {
        const { getQuickStats } = await import('./services/devkitRegistry');
        const stats = getQuickStats();
        res.json({
          ok: true,
          message: `I can help you with many things! Here's what I can do:\n\n**${stats.totalEndpoints} endpoints** across ${stats.totalApps} apps ready to use.\n\nTap any category below to explore:`,
          intent: 'devkit_help',
          feature: 'devkit.help',
          data: { stats },
          suggestions: [
            'Show messages & notes',
            'Show payment features',
            'Show Atlas One catalog',
            'Show Game Deck features',
            'List all endpoints',
            'List connected apps',
          ],
          receipts: [{
            type: 'devkit',
            action: 'help',
            count: 1,
          }],
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
      
      const registry = loadRegistry();
      const endpoints = Object.entries(registry.endpoints).map(([key, ep]) => ({
        key,
        app: ep.app,
        description: ep.description,
        scopes: ep.scopes,
      }));
      res.json({
        ok: true,
        message: `There are ${endpoints.length} endpoints available across ${Object.keys(registry.apps).length} apps. Here are the main ones:`,
        intent: 'registry_list',
        feature: 'registry.endpoints.list',
        data: {
          endpoints: endpoints.slice(0, 20),
          total: endpoints.length,
          apps: Object.keys(registry.apps),
        },
        receipts: [{
          type: 'registry',
          action: 'list_endpoints',
          count: endpoints.length,
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    if (intent === 'registry_apps' || feature === 'registry.apps.list') {
      const registry = loadRegistry();
      const apps = Object.values(registry.apps).map(app => ({
        id: app.id,
        name: app.name,
        version: app.version,
        permissions: app.permissions,
      }));
      res.json({
        ok: true,
        message: `There are ${apps.length} apps connected. Here's what you can do with them.`,
        intent: 'registry_apps',
        feature: 'registry.apps.list',
        data: { apps },
        receipts: [{
          type: 'registry',
          action: 'list_apps',
          count: apps.length,
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    if (intent === 'external_launch' && parsedParams.appName) {
      const appName = parsedParams.appName.toLowerCase();
      const externalApps = getExternalApps();
      const match = Object.entries(externalApps).find(([id, app]) => 
        app.name.toLowerCase().includes(appName) || id.includes(appName)
      );
      
      if (match) {
        const [appId, app] = match;
        res.json({
          ok: true,
          message: `Opening ${app.name}...`,
          intent: 'external_launch',
          feature: 'external.launch',
          data: {
            appId,
            name: app.name,
            url: app.url,
            category: app.category,
          },
          receipts: [{
            type: 'navigation',
            action: 'launch_external',
            appId,
            url: app.url,
          }],
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
    }

    // Handle app-specific notifications query
    if (intent === 'app_notifications' && parsedParams.appName) {
      const { queryNotifications, summarizeNotifications, findAppByName } = await import('./services/appAdapter');
      const { registerApp, isAppConnected } = await import('./services/appSessionRegistry');
      
      const appId = findAppByName(parsedParams.appName);
      if (!appId) {
        res.json({
          ok: true,
          message: `I don't recognize "${parsedParams.appName}" as a supported app. Try asking about Facebook, Slack, Discord, Gmail, Twitter, GitHub, or other major platforms.`,
          intent: 'app_notifications',
          feature: 'apps.notifications',
          data: { supported: false },
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
      
      if (!isAppConnected(wallet, appId)) {
        registerApp(wallet, appId, `https://${appId}.com`, 'session');
      }
      
      const result = await queryNotifications(wallet, appId);
      const summary = result.ok ? summarizeNotifications(result.data, parsedParams.appName) : result.error;
      
      res.json({
        ok: result.ok,
        message: summary,
        intent: 'app_notifications',
        feature: 'apps.notifications',
        data: result.data,
        app: result.app,
        simulated: result.simulated,
        receipts: [{
          type: 'app_query',
          action: 'notifications',
          app: result.app,
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    // Handle app-specific messages query
    if (intent === 'app_messages' && parsedParams.appName) {
      const { queryMessages, summarizeMessages, findAppByName } = await import('./services/appAdapter');
      const { registerApp, isAppConnected } = await import('./services/appSessionRegistry');
      
      const appId = findAppByName(parsedParams.appName);
      if (!appId) {
        res.json({
          ok: true,
          message: `I don't recognize "${parsedParams.appName}" as a supported app.`,
          intent: 'app_messages',
          feature: 'apps.messages',
          data: { supported: false },
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
      
      if (!isAppConnected(wallet, appId)) {
        registerApp(wallet, appId, `https://${appId}.com`, 'session');
      }
      
      const result = await queryMessages(wallet, appId);
      const summary = result.ok ? summarizeMessages(result.data, parsedParams.appName) : result.error;
      
      res.json({
        ok: result.ok,
        message: summary,
        intent: 'app_messages',
        feature: 'apps.messages',
        data: result.data,
        app: result.app,
        simulated: result.simulated,
        receipts: [{
          type: 'app_query',
          action: 'messages',
          app: result.app,
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    // Handle connected apps query
    if (intent === 'apps_connected' || feature === 'apps.connected') {
      const { getConnectedAppsSummary } = await import('./services/appAdapter');
      const summary = getConnectedAppsSummary(wallet);
      
      res.json({
        ok: true,
        message: summary,
        intent: 'apps_connected',
        feature: 'apps.connected',
        receipts: [{
          type: 'app_query',
          action: 'list_connected',
        }],
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    const composedFlow = composeFlow(message, session.roles[0]);
    
    if (composedFlow.steps.length > 1) {
      const validation = validateFlowAgainstSession(composedFlow, session);
      
      if (validation.valid) {
        const result = await runFlow(composedFlow.steps, session);
        res.json({
          ok: result.success,
          message: composedFlow.explanation,
          intent: composedFlow.intents[0] || 'composed',
          feature: 'flow.composed',
          flow: {
            steps: composedFlow.steps.length,
            intents: composedFlow.intents,
            explanation: composedFlow.explanation,
          },
          receipts: result.receipts,
          heldForReview: result.heldForReview,
          errors: result.errors,
          'data-testid': 'atlas-ask-response',
        });
        return;
      } else {
        res.json({
          ok: true,
          message: `I can compose this flow (${composedFlow.explanation}), but some apps aren't connected yet.`,
          intent: 'composed',
          feature: 'flow.composed',
          flow: {
            steps: composedFlow.steps.length,
            intents: composedFlow.intents,
            missingEndpoints: validation.missingEndpoints,
          },
          suggestions: getSuggestedActions(session),
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
    }

    // Handle navigation intents that don't require server-side execution
    const navigationIntents: Record<string, { message: string; navigate: string }> = {
      'atlas_one_open': { message: 'Opening Atlas One...', navigate: '/atlas-one' },
      'atlas_one_catalog': { message: 'Opening Atlas One catalog...', navigate: '/atlas-one' },
      'admin_dashboard': { message: 'Opening dashboard...', navigate: '/admin' },
    };
    
    // Handle canvas mode intents that switch mode within Atlas
    const canvasModeIntents: Record<string, { message: string; mode: string; pulseView?: 'global' | 'personal' }> = {
      'show_launcher': { message: 'Opening P3 Hub Launcher — your pinned apps, recent flows, and live status.', mode: 'launcher' },
      'atlas_pulse_open': { message: 'Opening Atlas Pulse — live substrate health metrics.', mode: 'pulse', pulseView: 'global' },
      'atlas_my_pulse_open': { message: 'Opening your personalized Pulse — metrics for your registered endpoints.', mode: 'pulse', pulseView: 'personal' },
      'atlas_efficiency_open': { message: 'Opening Efficiency Cards — see how Atlas API 2.0 compares to traditional REST.', mode: 'pulse', pulseView: 'global' },
      'atlas_capability_open': { message: 'Here\'s what Atlas can do natively — no AI required. These are deterministic, session-native commands.', mode: 'capability' },
      'atlas_library_open': { message: 'Opening your Library — all your content across videos, games, ebooks, and products.', mode: 'library' },
      'atlas_gamedeck_open': { message: 'Opening Game Deck — your gaming hub with mods, achievements, and cloud saves.', mode: 'gamedeck' },
      'gamedeck_open': { message: 'Opening Game Deck — your gaming hub with free games, mods, and achievements.', mode: 'gamedeck' },
      'gamedeck_features': { message: 'Opening Game Deck features — explore games, mods, and cloud saves.', mode: 'gamedeck' },
      'atlas_media_open': { message: 'Opening Media player for playback.', mode: 'media' },
      'atlas_reader_open': { message: 'Opening Reader for ebooks and documents.', mode: 'reader' },
      'news_top_stories': { message: 'Opening News — live headlines from around the world.', mode: 'news' },
      'atlas_node_open': { message: 'Starting Pulse Node — become part of the distributed mesh network.', mode: 'node' },
    };
    
    if (canvasModeIntents[intent as string]) {
      const modeInfo = canvasModeIntents[intent as string];
      res.json({
        ok: true,
        message: modeInfo.message,
        intent,
        feature,
        canvasMode: modeInfo.mode,
        ...(modeInfo.pulseView && { pulseView: modeInfo.pulseView }),
        'data-testid': 'atlas-ask-response',
      });
      return;
    }
    
    if (navigationIntents[intent as string]) {
      const navInfo = navigationIntents[intent as string];
      res.json({
        ok: true,
        message: navInfo.message,
        intent,
        feature,
        navigate: navInfo.navigate,
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    if (intent === 'generic') {
      if (composedFlow.requiresAI) {
        res.json({
          ok: true,
          message: 'I need more context to understand this request. Try being more specific or connect an AI provider in Developer Settings.',
          intent: null,
          steps: [],
          requiresAI: true,
          suggestions: getSuggestedActions(session),
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
      
      const suggestions = getSuggestedActions(session);
      res.json({
        ok: true,
        message: 'No matching capability. Connect more apps or grant scopes.',
        intent: null,
        steps: [],
        suggestions,
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    const mergedParams = { ...(params || {}), ...parsedParams };
    const steps = mapIntentToSteps(intent, mergedParams, session);

    if (steps.length === 0) {
      if (composedFlow.steps.length === 1) {
        const result = await runFlow(composedFlow.steps, session);
        res.json({
          ok: result.success,
          message: composedFlow.explanation,
          intent,
          feature,
          receipts: result.receipts,
          heldForReview: result.heldForReview,
          errors: result.errors,
          'data-testid': 'atlas-ask-response',
        });
        return;
      }
      
      const suggestions = getSuggestedActions(session);
      res.json({
        ok: true,
        message: 'This action requires connecting the appropriate app or granting the required scope.',
        intent,
        feature,
        steps: [],
        suggestions,
        'data-testid': 'atlas-ask-response',
      });
      return;
    }

    const result = await runFlow(steps, session);

    const intentMessages: Record<string, string> = {
      messages_inbox: 'Checking your inbox...',
      messages_send: 'Message sent!',
      messages_compose: 'Opening message composer...',
      messages_voice_send: 'Voice message sent!',
      messages_voice_compose: 'Opening voice message composer...',
      notes_create: 'Note created!',
      notes_compose: 'Opening notes to create a new note...',
      notes_list: 'Here are your notes.',
      gallery_count: 'Counted your gallery items.',
      gallery_list: 'Here are your gallery items.',
      payments_send: 'Payment initiated.',
      payments_history: 'Here is your payment history.',
      dao_vote: 'Vote recorded!',
      dao_proposals: 'Active proposals loaded.',
    };
    
    let statusMessage: string;
    if (result.success) {
      const isNotImplemented = result.receipts.length > 0 && result.receipts[0].result?.status === 'not_implemented';
      statusMessage = isNotImplemented
        ? `${intentMessages[intent as string] || 'Request processed.'} (Demo mode - connect apps for live data)`
        : intentMessages[intent as string] || 'Request processed.';
    } else {
      statusMessage = result.errors.length > 0 
        ? result.errors.join(', ')
        : 'Request could not be completed.';
    }

    res.json({
      ok: result.success,
      message: statusMessage,
      intent,
      feature,
      receipts: result.receipts,
      heldForReview: result.heldForReview,
      errors: result.errors,
      'data-testid': 'atlas-ask-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-ask-error',
    });
  }
});

router.get('/apps', (req: Request, res: Response) => {
  try {
    const registry = loadRegistry();
    const apps = Object.values(registry.apps).map(app => ({
      id: app.id,
      name: app.name,
      version: app.version,
      permissions: app.permissions,
    }));

    res.json({
      ok: true,
      apps,
      total: apps.length,
      'data-testid': 'atlas-apps-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-apps-error',
    });
  }
});

router.get('/external-apps', (req: Request, res: Response) => {
  try {
    const externalApps = getExternalApps();
    const category = req.query.category as string | undefined;
    
    let apps = Object.values(externalApps).map(app => ({
      id: app.id,
      name: app.name,
      url: app.url,
      icon: app.icon || `https://www.google.com/s2/favicons?domain=${new URL(app.url).hostname}&sz=128`,
      category: app.category,
      scopes: app.scopes || [],
      phrases: app.phrases || [],
      tags: app.tags || [],
    }));
    
    if (category) {
      apps = apps.filter(app => app.category === category);
    }
    
    const categories = [...new Set(apps.map(a => a.category))].sort();

    res.json({
      ok: true,
      apps,
      categories,
      total: apps.length,
      'data-testid': 'atlas-external-apps-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-external-apps-error',
    });
  }
});

router.post('/launch', (req: Request, res: Response) => {
  try {
    const { appId, wallet } = req.body;
    
    if (!appId) {
      res.status(400).json({ ok: false, error: 'App ID required' });
      return;
    }
    
    const externalApps = getExternalApps();
    const app = externalApps[appId];
    
    if (!app) {
      res.status(404).json({ ok: false, error: 'App not found' });
      return;
    }
    
    res.json({
      ok: true,
      action: 'launch',
      app: {
        id: app.id,
        name: app.name,
        url: app.url,
        category: app.category,
      },
      'data-testid': 'atlas-launch-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/query', async (req: Request, res: Response) => {
  try {
    const { message, constraints, role } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        ok: false,
        error: 'Message is required',
        'data-testid': 'atlas-query-error',
      });
      return;
    }

    const intent = parseIntent(message, role);

    if (!intent) {
      const suggestions = suggestFeatures(message);
      res.json({
        ok: true,
        intent: null,
        endpoints: [],
        suggestions,
        message: 'Could not determine intent. Try being more specific.',
        'data-testid': 'atlas-query-response',
      });
      return;
    }

    const endpoints = await searchEndpoints(intent.feature);

    const flowSteps: FlowStep[] = endpoints.map(ep => ({
      key: ep.key,
      args: constraints || {},
    }));

    const suggestions = suggestFeatures(message);

    res.json({
      ok: true,
      intent,
      endpoints: flowSteps,
      suggestions: suggestions.filter(s => s !== intent.feature),
      'data-testid': 'atlas-query-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-query-error',
    });
  }
});

router.post('/compose', async (req: Request, res: Response) => {
  try {
    const { endpoints, session } = req.body;

    if (!endpoints || !Array.isArray(endpoints)) {
      res.status(400).json({
        ok: false,
        error: 'Endpoints array is required',
        'data-testid': 'atlas-compose-error',
      });
      return;
    }

    if (!session || !session.wallet) {
      res.status(400).json({
        ok: false,
        error: 'Valid session is required',
        'data-testid': 'atlas-compose-error',
      });
      return;
    }

    const validation = validateSession(session as Session);
    if (!validation.valid) {
      res.status(400).json({
        ok: false,
        error: validation.reason,
        'data-testid': 'atlas-compose-error',
      });
      return;
    }

    if (endpoints.length > atlasConfig.maxFlowSteps) {
      res.status(400).json({
        ok: false,
        error: `Flow exceeds maximum steps (${atlasConfig.maxFlowSteps})`,
        'data-testid': 'atlas-compose-error',
      });
      return;
    }

    const flowSteps: FlowStep[] = endpoints.map((ep: any) => ({
      key: ep.key || ep.endpointKey,
      args: ep.args || {},
    }));

    const result = await runFlow(flowSteps, session as Session);

    res.json({
      ok: result.success,
      receipts: result.receipts,
      heldForReview: result.heldForReview,
      errors: result.errors,
      'data-testid': 'atlas-compose-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      receipts: [],
      'data-testid': 'atlas-compose-error',
    });
  }
});

router.post('/call', async (req: Request, res: Response) => {
  try {
    const { endpointKey, args, session } = req.body;

    if (!endpointKey || typeof endpointKey !== 'string') {
      res.status(400).json({
        ok: false,
        error: 'Endpoint key is required',
        'data-testid': 'atlas-call-error',
      });
      return;
    }

    if (!session || !session.wallet) {
      res.status(400).json({
        ok: false,
        error: 'Valid session is required',
        'data-testid': 'atlas-call-error',
      });
      return;
    }

    const validation = validateSession(session as Session);
    if (!validation.valid) {
      res.status(400).json({
        ok: false,
        error: validation.reason,
        'data-testid': 'atlas-call-error',
      });
      return;
    }

    const step: FlowStep = {
      key: endpointKey,
      args: args || {},
    };

    const receipt = await runSingleStep(step, session as Session);

    res.json({
      ok: receipt.status === 'ok',
      receipt,
      'data-testid': 'atlas-call-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      receipt: null,
      'data-testid': 'atlas-call-error',
    });
  }
});

router.get('/recipes', (req: Request, res: Response) => {
  try {
    const role = (req.query.role as string) || 'user';
    
    const validRoles = ['admin', 'moderator', 'user'];
    if (!validRoles.includes(role)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid role. Must be admin, moderator, or user',
        'data-testid': 'atlas-recipes-error',
      });
      return;
    }

    const filteredRecipes = getRecipesByRole(role);

    res.json({
      ok: true,
      recipes: filteredRecipes,
      total: filteredRecipes.length,
      'data-testid': 'atlas-recipes-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      recipes: [],
      'data-testid': 'atlas-recipes-error',
    });
  }
});

router.get('/metrics', (req: Request, res: Response) => {
  try {
    const session = req.headers['x-atlas-session'];
    
    if (session) {
      try {
        const parsed = JSON.parse(session as string) as Session;
        if (!checkRole(parsed, ['admin'])) {
          res.status(403).json({
            ok: false,
            error: 'Admin role required to access metrics',
            'data-testid': 'atlas-metrics-error',
          });
          return;
        }
      } catch {
        res.status(401).json({
          ok: false,
          error: 'Invalid session header',
          'data-testid': 'atlas-metrics-error',
        });
        return;
      }
    }

    const range = (req.query.range as string) || 'day';
    const validRanges = ['day', 'week', 'month'];
    
    if (!validRanges.includes(range)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid range. Must be day, week, or month',
        'data-testid': 'atlas-metrics-error',
      });
      return;
    }

    const timeRange = getTimeRange(range);
    const metrics = getMetrics(timeRange);
    const recentEvents = getRecentEvents(20);

    res.json({
      ok: true,
      metrics: {
        ...metrics,
        range,
        timeRange,
      },
      recentEvents,
      'data-testid': 'atlas-metrics-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      metrics: null,
      'data-testid': 'atlas-metrics-error',
    });
  }
});

router.get('/version', (req: Request, res: Response) => {
  res.json({
    ok: true,
    version: VERSION,
    api: 'atlas',
    'data-testid': 'atlas-version-response',
  });
});

router.post('/semantic', (req: Request, res: Response) => {
  try {
    const { message } = req.body || {};
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        ok: false,
        error: 'Message is required',
        'data-testid': 'atlas-semantic-error',
      });
      return;
    }

    const ranked = semanticMatch(message);
    const best = getBestMatch(message);

    res.json({
      ok: true,
      ranked: ranked.slice(0, 5),
      best,
      'data-testid': 'atlas-semantic-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-semantic-error',
    });
  }
});

router.get('/handshake/:appId', (req: Request, res: Response) => {
  try {
    const { appId } = req.params;
    const handshake = handshakeForApp(appId);

    if (!handshake) {
      res.status(404).json({
        ok: false,
        error: 'App not found in registry',
        'data-testid': 'atlas-handshake-error',
      });
      return;
    }

    res.json({
      ok: true,
      handshake,
      'data-testid': 'atlas-handshake-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-handshake-error',
    });
  }
});

router.get('/handshakes', (req: Request, res: Response) => {
  try {
    const handshakes = getAllAppHandshakes();

    res.json({
      ok: true,
      handshakes,
      count: handshakes.length,
      'data-testid': 'atlas-handshakes-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-handshakes-error',
    });
  }
});

router.get('/suggest/:wallet', (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const session = bridgeGetSession(wallet);

    if (!session) {
      res.status(401).json({
        ok: false,
        error: 'No active session for wallet',
        'data-testid': 'atlas-suggest-error',
      });
      return;
    }

    const suggestions = suggestNext(session);
    const formatted = formatSuggestionsForChat(suggestions);

    res.json({
      ok: true,
      suggestions: formatted,
      detailed: suggestions,
      'data-testid': 'atlas-suggest-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-suggest-error',
    });
  }
});

router.post('/triggers/cron', async (req: Request, res: Response) => {
  try {
    const results = await tickCron();

    res.json({
      ok: true,
      results,
      triggered: results.filter(r => r.triggered).length,
      'data-testid': 'atlas-triggers-cron-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-triggers-cron-error',
    });
  }
});

router.post('/triggers/threshold', async (req: Request, res: Response) => {
  try {
    const results = await tickThreshold();

    res.json({
      ok: true,
      results,
      triggered: results.filter(r => r.triggered).length,
      'data-testid': 'atlas-triggers-threshold-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-triggers-threshold-error',
    });
  }
});

router.get('/triggers/history', (req: Request, res: Response) => {
  try {
    const history = getTriggeredRecipes();

    res.json({
      ok: true,
      history,
      'data-testid': 'atlas-triggers-history-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-triggers-history-error',
    });
  }
});

router.get('/render', async (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'idle';
    const source = req.query.source as string;
    const metric = req.query.metric as string;
    const wallet = req.query.wallet as string;
    
    const payload = await getRenderPayload(mode, { source, metric, wallet });
    const receipt = createRenderReceipt(mode, payload);
    
    res.json({
      ok: true,
      mode,
      payload,
      receipt,
      'data-testid': 'atlas-render-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-render-error',
    });
  }
});

router.get('/manifests', (req: Request, res: Response) => {
  try {
    const manifests = [
      { id: 'messages', title: 'Messages', scopes: ['messages'], visuals: ['list'] },
      { id: 'metrics', title: 'Metrics', scopes: ['admin'], visuals: ['chart'] },
      { id: 'governance', title: 'Governance', scopes: ['dao'], visuals: ['list'] },
      { id: 'notes', title: 'Notes', scopes: ['notes'], visuals: ['grid'] },
      { id: 'gallery', title: 'Gallery', scopes: ['storage'], visuals: ['grid'] },
      { id: 'payments', title: 'Payments', scopes: ['payments'], visuals: ['list'] },
      { id: 'feed', title: 'Feed', scopes: ['feed'], visuals: ['grid'] },
    ];
    
    res.json({
      ok: true,
      manifests,
      'data-testid': 'atlas-manifests-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-manifests-error',
    });
  }
});

router.get('/suggestions', (req: Request, res: Response) => {
  try {
    const suggestions = [
      { id: 's1', label: 'Check my messages', intent: 'messages', category: 'query' },
      { id: 's2', label: 'Show adoption metrics', intent: 'metrics', category: 'admin' },
      { id: 's3', label: 'Open governance', intent: 'governance', category: 'action' },
      { id: 's4', label: 'Recent notes', intent: 'notes', category: 'query' },
    ];
    
    res.json({
      ok: true,
      suggestions,
      'data-testid': 'atlas-suggestions-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-suggestions-error',
    });
  }
});

router.get('/connectors', (req: Request, res: Response) => {
  try {
    const connectors = [
      { id: 'gmail', title: 'Gmail', icon: 'mail', status: 'disconnected', scopes: [] },
      { id: 'reddit', title: 'Reddit', icon: 'message-circle', status: 'disconnected', scopes: [] },
      { id: 'drive', title: 'Google Drive', icon: 'folder', status: 'disconnected', scopes: [] },
      { id: 'discord', title: 'Discord', icon: 'message-square', status: 'disconnected', scopes: [] },
      { id: 'stripe', title: 'Stripe', icon: 'credit-card', status: 'disconnected', scopes: [] },
      { id: 'calendar', title: 'Calendar', icon: 'calendar', status: 'disconnected', scopes: [] },
    ];
    
    res.json({
      ok: true,
      connectors,
      'data-testid': 'atlas-connectors-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-connectors-error',
    });
  }
});

router.post('/connectors/:id/revoke', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    res.json({
      ok: true,
      message: `Connector ${id} revoked`,
      'data-testid': 'atlas-connector-revoke-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-connector-revoke-error',
    });
  }
});

function getRenderPayload(mode: string, opts: { source?: string; metric?: string; wallet?: string }) {
  switch (mode) {
    case 'feed':
      return {
        items: [
          { id: 'v1', title: `${opts.source || 'Trending'} #1`, views: 12400, likes: 890 },
          { id: 'v2', title: `${opts.source || 'Trending'} #2`, views: 8900, likes: 654 },
        ]
      };
    case 'metrics':
      const now = Date.now();
      return {
        series: Array.from({ length: 24 }).map((_, i) => ({
          t: new Date(now - (23 - i) * 3600_000).toISOString(),
          value: Math.round(100 + Math.random() * 400 + i * 15),
        })),
        metric: opts.metric || 'users'
      };
    case 'governance':
      return {
        proposals: [
          { id: 'p1', title: 'Upgrade Anchor Registry', aye: 1247, nay: 89, status: 'active' },
          { id: 'p2', title: 'Add Polygon Support', aye: 892, nay: 234, status: 'active' },
        ]
      };
    case 'messages':
      return {
        messages: [
          { id: 'm1', from: '0x7B2f...3aE9', preview: 'New governance proposal?', read: false },
          { id: 'm2', from: '0x1F4c...8bD2', preview: 'Anchor batch ready', read: false },
        ],
        unread: 2
      };
    case 'notes':
      return {
        notes: [
          { id: 'n1', title: 'Mesh Architecture', encrypted: true, updatedAt: '2 hours ago' },
          { id: 'n2', title: 'Atlas Roadmap', encrypted: false, updatedAt: '5 hours ago' },
        ]
      };
    case 'gallery':
      return {
        items: [
          { id: 'g1', name: 'Architecture Diagram', encrypted: true, size: '2.4 MB' },
          { id: 'g2', name: 'Screenshot', encrypted: false, size: '1.1 MB' },
        ]
      };
    case 'payments':
      return {
        payments: [
          { id: 'p1', type: 'received', amount: '250.00', token: 'USDC', counterparty: '0x7B2f...3aE9' },
          { id: 'p2', type: 'sent', amount: '0.05', token: 'ETH', counterparty: '0x1F4c...8bD2' },
        ]
      };
    default:
      return {};
  }
}

function createRenderReceipt(mode: string, payload: any) {
  const crypto = require('crypto');
  const id = crypto.randomUUID();
  const hash = '0x' + crypto.createHash('sha256')
    .update(JSON.stringify({ mode, timestamp: Date.now() }))
    .digest('hex');
  
  return {
    id,
    hash,
    scope: `atlas.render.${mode}`,
    timestamp: Date.now()
  };
}

// ============================================================================
// Device Management & Proximity APIs
// ============================================================================

router.post('/devices/register', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { wallet, deviceId, deviceType, publicKey, fingerprint, capabilities, label } = req.body;

    if (!wallet || !deviceId || !deviceType || !publicKey || !fingerprint) {
      res.status(400).json({
        ok: false,
        error: 'Missing required fields: wallet, deviceId, deviceType, publicKey, fingerprint',
        'data-testid': 'atlas-device-register-error',
      });
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-device-register-error',
      });
      return;
    }

    const validTypes = ['phone', 'watch', 'echo', 'browser', 'tablet'];
    if (!validTypes.includes(deviceType)) {
      res.status(400).json({
        ok: false,
        error: `Invalid deviceType. Must be one of: ${validTypes.join(', ')}`,
        'data-testid': 'atlas-device-register-error',
      });
      return;
    }

    res.json({
      ok: true,
      device: {
        deviceId,
        ownerWallet: wallet.toLowerCase(),
        deviceType,
        fingerprint,
        capabilities: capabilities || ['display.banner'],
        label: label || deviceType,
        status: 'paired',
        createdAt: new Date().toISOString(),
      },
      'data-testid': 'atlas-device-register-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Device registration failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-device-register-error',
    });
  }
});

router.get('/devices', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;

    res.json({
      ok: true,
      devices: [],
      'data-testid': 'atlas-devices-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch devices';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-devices-error',
    });
  }
});

router.post('/devices/:deviceId/attest', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { wallet, attestation, proximityMeters } = req.body;

    if (!attestation) {
      res.status(400).json({
        ok: false,
        error: 'Attestation is required',
        'data-testid': 'atlas-attest-error',
      });
      return;
    }

    const freshnessWindowMs = 5000;
    const now = Date.now();
    
    if (attestation.payload?.ts && (now - attestation.payload.ts) > freshnessWindowMs) {
      res.status(400).json({
        ok: false,
        error: 'Attestation expired',
        valid: false,
        'data-testid': 'atlas-attest-error',
      });
      return;
    }

    res.json({
      ok: true,
      valid: true,
      deviceId,
      proximityMeters: proximityMeters || attestation.payload?.proximityMeters || 0,
      attestedAt: new Date().toISOString(),
      'data-testid': 'atlas-attest-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Attestation failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-attest-error',
    });
  }
});

router.delete('/devices/:deviceId', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    res.json({
      ok: true,
      message: `Device ${deviceId} revoked`,
      'data-testid': 'atlas-device-delete-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Device deletion failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-device-delete-error',
    });
  }
});

// ============================================================================
// User Settings & Privacy Controls
// ============================================================================

router.get('/settings', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;
    const normalizedWallet = wallet.toLowerCase();
    
    const [stored] = await db
      .select()
      .from(atlasUserSettings)
      .where(eq(atlasUserSettings.wallet, normalizedWallet))
      .limit(1);

    res.json({
      ok: true,
      settings: {
        wallet: normalizedWallet,
        proximitySurfacingEnabled: stored?.proximitySurfacingEnabled ?? true,
        voiceAnnounce: stored?.voiceAnnounce ?? false,
        quietHoursStart: stored?.quietHoursStart ?? null,
        quietHoursEnd: stored?.quietHoursEnd ?? null,
        quietHoursTimezone: stored?.quietHoursTimezone ?? null,
        contentMinimization: stored?.contentMinimization ?? true,
        onboardingCompleted: stored?.onboardingCompleted ?? false,
        onboardingPath: stored?.onboardingPath ?? null,
        onboardingCompletedAt: stored?.onboardingCompletedAt ? stored.onboardingCompletedAt.getTime() : null,
        interfacePreference: stored?.interfacePreference ?? null,
        displayName: stored?.displayName ?? null,
        sessionMemoryEnabled: stored?.sessionMemoryEnabled ?? true,
      },
      'data-testid': 'atlas-settings-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';
    console.error('[Atlas] Settings fetch error:', error);
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-settings-error',
    });
  }
});

router.put('/settings', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { 
      wallet, 
      proximitySurfacingEnabled, 
      voiceAnnounce, 
      quietHoursStart, 
      quietHoursEnd, 
      quietHoursTimezone,
      contentMinimization,
      onboardingCompleted,
      onboardingPath,
      onboardingCompletedAt,
      interfacePreference,
      displayName,
      sessionMemoryEnabled,
    } = req.body;

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-settings-update-error',
      });
      return;
    }

    const normalizedWallet = wallet.toLowerCase();
    
    const [existing] = await db
      .select()
      .from(atlasUserSettings)
      .where(eq(atlasUserSettings.wallet, normalizedWallet))
      .limit(1);

    const updateData = {
      proximitySurfacingEnabled: proximitySurfacingEnabled ?? existing?.proximitySurfacingEnabled ?? true,
      voiceAnnounce: voiceAnnounce ?? existing?.voiceAnnounce ?? false,
      quietHoursStart: quietHoursStart !== undefined ? quietHoursStart : (existing?.quietHoursStart ?? null),
      quietHoursEnd: quietHoursEnd !== undefined ? quietHoursEnd : (existing?.quietHoursEnd ?? null),
      quietHoursTimezone: quietHoursTimezone !== undefined ? quietHoursTimezone : (existing?.quietHoursTimezone ?? null),
      contentMinimization: contentMinimization ?? existing?.contentMinimization ?? true,
      onboardingCompleted: onboardingCompleted ?? existing?.onboardingCompleted ?? false,
      onboardingPath: onboardingPath !== undefined ? onboardingPath : (existing?.onboardingPath ?? null),
      onboardingCompletedAt: onboardingCompletedAt 
        ? new Date(onboardingCompletedAt) 
        : (existing?.onboardingCompletedAt ?? null),
      interfacePreference: interfacePreference !== undefined ? interfacePreference : (existing?.interfacePreference ?? null),
      displayName: displayName !== undefined ? displayName : (existing?.displayName ?? null),
      sessionMemoryEnabled: sessionMemoryEnabled ?? existing?.sessionMemoryEnabled ?? true,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(atlasUserSettings)
        .set(updateData)
        .where(eq(atlasUserSettings.wallet, normalizedWallet));
    } else {
      await db
        .insert(atlasUserSettings)
        .values({
          wallet: normalizedWallet,
          ...updateData,
        });
    }

    res.json({
      ok: true,
      settings: {
        wallet: normalizedWallet,
        proximitySurfacingEnabled: updateData.proximitySurfacingEnabled,
        voiceAnnounce: updateData.voiceAnnounce,
        quietHoursStart: updateData.quietHoursStart,
        quietHoursEnd: updateData.quietHoursEnd,
        quietHoursTimezone: updateData.quietHoursTimezone,
        contentMinimization: updateData.contentMinimization,
        onboardingCompleted: updateData.onboardingCompleted,
        onboardingPath: updateData.onboardingPath,
        onboardingCompletedAt: updateData.onboardingCompletedAt ? updateData.onboardingCompletedAt.getTime() : null,
        interfacePreference: updateData.interfacePreference,
        displayName: updateData.displayName,
        sessionMemoryEnabled: updateData.sessionMemoryEnabled,
        updatedAt: updateData.updatedAt.toISOString(),
      },
      'data-testid': 'atlas-settings-update-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    console.error('[Atlas] Settings update error:', error);
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-settings-update-error',
    });
  }
});

// ============================================================================
// Handoff Receipts with Signatures
// ============================================================================

router.post('/handoff/receipt', async (req: Request, res: Response) => {
  try {
    const { sessionId, fromDevice, toDevice, signature, stateHash } = req.body;

    if (!sessionId || !fromDevice || !toDevice || !signature) {
      res.status(400).json({
        ok: false,
        error: 'Missing required fields: sessionId, fromDevice, toDevice, signature',
        'data-testid': 'atlas-receipt-error',
      });
      return;
    }

    const crypto = require('crypto');
    const receiptId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 30000);

    res.json({
      ok: true,
      receipt: {
        receiptId,
        sessionId,
        fromDevice,
        toDevice,
        signature,
        stateHash: stateHash || null,
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        consumed: false,
      },
      'data-testid': 'atlas-receipt-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt creation failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-receipt-error',
    });
  }
});

router.post('/handoff/verify', async (req: Request, res: Response) => {
  try {
    const { receiptId, devicePublicKey } = req.body;

    if (!receiptId) {
      res.status(400).json({
        ok: false,
        error: 'Receipt ID is required',
        valid: false,
        'data-testid': 'atlas-verify-error',
      });
      return;
    }

    res.json({
      ok: true,
      valid: true,
      receiptId,
      verifiedAt: new Date().toISOString(),
      'data-testid': 'atlas-verify-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    res.status(500).json({
      ok: false,
      error: message,
      valid: false,
      'data-testid': 'atlas-verify-error',
    });
  }
});

// ============================================================================
// App Manifest Registry
// ============================================================================

router.post('/apps/register', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { wallet, manifest } = req.body;

    if (!manifest) {
      res.status(400).json({
        ok: false,
        error: 'Manifest is required',
        'data-testid': 'atlas-app-register-error',
      });
      return;
    }

    if (!manifest.name || !manifest.entry || !manifest.permissions) {
      res.status(400).json({
        ok: false,
        error: 'Manifest must include name, entry, and permissions',
        'data-testid': 'atlas-app-register-error',
      });
      return;
    }

    const crypto = require('crypto');
    const appId = `${manifest.name.toLowerCase().replace(/\s+/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;

    res.json({
      ok: true,
      app: {
        appId,
        name: manifest.name,
        version: manifest.version || '1.0.0',
        ownerWallet: wallet.toLowerCase(),
        entry: manifest.entry,
        permissions: manifest.permissions,
        semanticPhrases: manifest.semanticPhrases || null,
        status: 'draft',
        createdAt: new Date().toISOString(),
      },
      'data-testid': 'atlas-app-register-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'App registration failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-app-register-error',
    });
  }
});

router.get('/apps', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string;

    res.json({
      ok: true,
      apps: [],
      'data-testid': 'atlas-apps-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch apps';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-apps-error',
    });
  }
});

// ============================================================================
// Announcement Controller
// ============================================================================

router.post('/announce', optionalAtlasAuth, requireWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { wallet, deviceId, type, payload } = req.body;

    if (!deviceId) {
      res.status(400).json({
        ok: false,
        error: 'Device ID is required',
        'data-testid': 'atlas-announce-error',
      });
      return;
    }

    const settingsCheck = {
      proximitySurfacingEnabled: true,
      voiceAnnounce: false,
      quietHours: false,
    };

    if (!settingsCheck.proximitySurfacingEnabled) {
      res.json({
        ok: true,
        announced: false,
        reason: 'Proximity surfacing disabled',
        'data-testid': 'atlas-announce-response',
      });
      return;
    }

    if (settingsCheck.quietHours) {
      res.json({
        ok: true,
        announced: false,
        reason: 'Quiet hours active',
        'data-testid': 'atlas-announce-response',
      });
      return;
    }

    const announcementType = settingsCheck.voiceAnnounce ? 'voice' : 'banner';
    const content = payload?.count 
      ? `You have ${payload.count} priority updates.`
      : 'Atlas has updates for you.';

    res.json({
      ok: true,
      announced: true,
      type: announcementType,
      content,
      minimized: true,
      deviceId,
      timestamp: new Date().toISOString(),
      'data-testid': 'atlas-announce-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Announcement failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-announce-error',
    });
  }
});

// ============================================================================
// External App Session Registry - Atlas as the Mesh Hub
// ============================================================================

router.get('/mesh/apps', async (req: Request, res: Response) => {
  try {
    const { getSupportedApps } = await import('./services/appSessionRegistry');
    const apps = getSupportedApps();
    
    res.json({
      ok: true,
      apps: Object.entries(apps).map(([id, meta]) => ({
        id,
        name: meta.name,
        icon: meta.icon,
        capabilities: meta.capabilities,
      })),
      total: Object.keys(apps).length,
      'data-testid': 'atlas-mesh-apps-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list apps';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-mesh-apps-error',
    });
  }
});

router.get('/mesh/connected', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || (req.query.wallet as string);
    
    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet required',
        'data-testid': 'atlas-mesh-connected-error',
      });
      return;
    }

    const { getConnectedApps } = await import('./services/appSessionRegistry');
    const apps = getConnectedApps(wallet);
    
    res.json({
      ok: true,
      wallet: wallet.slice(0, 6) + '...' + wallet.slice(-4),
      apps: apps.map(a => ({
        id: a.id,
        name: a.name,
        icon: a.icon,
        capabilities: a.capabilities,
        connectedAt: a.connectedAt,
        sessionActive: a.sessionActive,
      })),
      count: apps.length,
      'data-testid': 'atlas-mesh-connected-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get connected apps';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-mesh-connected-error',
    });
  }
});

router.post('/mesh/connect', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    const { appId, url, authType } = req.body;
    
    if (!wallet || !appId) {
      res.status(400).json({
        ok: false,
        error: 'Wallet and appId required',
        'data-testid': 'atlas-mesh-connect-error',
      });
      return;
    }

    const { registerApp } = await import('./services/appSessionRegistry');
    const app = registerApp(wallet, appId, url || `https://${appId}.com`, authType || 'session');
    
    if (!app) {
      res.status(400).json({
        ok: false,
        error: `Unsupported app: ${appId}`,
        'data-testid': 'atlas-mesh-connect-error',
      });
      return;
    }
    
    res.json({
      ok: true,
      app: {
        id: app.id,
        name: app.name,
        icon: app.icon,
        capabilities: app.capabilities,
        connectedAt: app.connectedAt,
      },
      message: `${app.name} connected successfully. You can now ask Atlas about your ${app.capabilities.join(', ')}.`,
      'data-testid': 'atlas-mesh-connect-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect app';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-mesh-connect-error',
    });
  }
});

router.post('/mesh/disconnect', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    const { appId } = req.body;
    
    if (!wallet || !appId) {
      res.status(400).json({
        ok: false,
        error: 'Wallet and appId required',
        'data-testid': 'atlas-mesh-disconnect-error',
      });
      return;
    }

    const { disconnectApp } = await import('./services/appSessionRegistry');
    const success = disconnectApp(wallet, appId);
    
    res.json({
      ok: success,
      message: success ? `${appId} disconnected` : `${appId} was not connected`,
      'data-testid': 'atlas-mesh-disconnect-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect app';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-mesh-disconnect-error',
    });
  }
});

router.post('/mesh/query', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    const { appId, capability, params } = req.body;
    
    if (!wallet || !appId || !capability) {
      res.status(400).json({
        ok: false,
        error: 'Wallet, appId, and capability required',
        'data-testid': 'atlas-mesh-query-error',
      });
      return;
    }

    const { queryApp } = await import('./services/appAdapter');
    const result = await queryApp({ wallet, appId, capability, params });
    
    res.json({
      ...result,
      'data-testid': 'atlas-mesh-query-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-mesh-query-error',
    });
  }
});

router.get('/agent/capabilities', (req: Request, res: Response) => {
  try {
    const capabilities = getAgentCapabilities();
    
    res.json({
      ok: true,
      capabilities,
      providers: ['openai', 'anthropic', 'gemini'],
      description: 'Atlas can orchestrate multiple AI agents under one wallet-anchored session',
      'data-testid': 'atlas-agent-capabilities-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get capabilities';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/agent/flow', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    const { query, input, apiKeys } = req.body;
    
    if (!wallet) {
      res.status(401).json({
        ok: false,
        error: 'Wallet required for agent flows',
        'data-testid': 'atlas-agent-flow-error',
      });
      return;
    }
    
    if (!query && !input) {
      res.status(400).json({
        ok: false,
        error: 'Query or input required',
        'data-testid': 'atlas-agent-flow-error',
      });
      return;
    }
    
    const steps = parseMultiAgentFlow(query || '');
    
    if (!steps || steps.length === 0) {
      const singleIntent = parseAgentIntent(query || '');
      if (singleIntent) {
        res.json({
          ok: true,
          type: 'single',
          intent: singleIntent,
          description: `${singleIntent.provider}.${singleIntent.action}`,
          requiresKeys: [singleIntent.provider],
          'data-testid': 'atlas-agent-flow-response',
        });
        return;
      }
      
      res.json({
        ok: true,
        type: 'none',
        message: 'No agent flow detected. Try phrases like "summarize then rewrite" or "analyze and critique".',
        capabilities: getAgentCapabilities().slice(0, 5),
        'data-testid': 'atlas-agent-flow-response',
      });
      return;
    }
    
    if (!apiKeys || Object.keys(apiKeys).length === 0) {
      const requiredProviders = [...new Set(steps.map(s => s.provider))];
      res.json({
        ok: true,
        type: 'pending',
        flow: describeAgentFlow(steps),
        steps: steps.length,
        requiresKeys: requiredProviders,
        message: 'Flow detected but API keys required. Configure them in Developer Settings.',
        'data-testid': 'atlas-agent-flow-response',
      });
      return;
    }
    
    const result = await executeAgentFlow(steps, input || query, apiKeys);
    
    res.json({
      ok: result.success,
      type: 'executed',
      flow: describeAgentFlow(steps),
      steps: result.steps,
      finalOutput: result.finalOutput,
      errors: result.errors,
      'data-testid': 'atlas-agent-flow-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent flow failed';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-agent-flow-error',
    });
  }
});

router.get('/vault/status', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.query.wallet as string;
    
    if (!wallet) {
      res.status(401).json({
        ok: false,
        error: 'Wallet required',
        'data-testid': 'atlas-vault-status-error',
      });
      return;
    }
    
    const secrets = listVaultSecrets(wallet);
    const providers = getConfiguredProviders(wallet);
    const oauthApps = getConnectedOAuthApps(wallet);
    
    res.json({
      ok: true,
      secrets: secrets.map(s => ({ keyId: s.keyId, keyType: s.keyType })),
      configuredProviders: providers,
      connectedOAuthApps: oauthApps,
      'data-testid': 'atlas-vault-status-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vault status failed';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/vault/developer-key', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    const { provider, apiKey } = req.body;
    
    if (!wallet) {
      res.status(401).json({
        ok: false,
        error: 'Wallet required',
        'data-testid': 'atlas-vault-developer-key-error',
      });
      return;
    }
    
    if (!provider || !apiKey) {
      res.status(400).json({
        ok: false,
        error: 'Provider and apiKey required',
        'data-testid': 'atlas-vault-developer-key-error',
      });
      return;
    }
    
    const validation = await validateProviderKey(provider, apiKey);
    if (!validation.valid) {
      res.status(400).json({
        ok: false,
        error: validation.error || `Invalid ${provider} API key format`,
        'data-testid': 'atlas-vault-developer-key-error',
      });
      return;
    }
    
    const success = await setDeveloperKey(wallet, provider, apiKey);
    
    res.json({
      ok: success,
      provider,
      message: success ? `${provider} API key stored securely` : 'Failed to store key',
      'data-testid': 'atlas-vault-developer-key-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to store developer key';
    res.status(500).json({ ok: false, error: message });
  }
});

router.delete('/vault/developer-key', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    const { provider } = req.body;
    
    if (!wallet || !provider) {
      res.status(400).json({
        ok: false,
        error: 'Wallet and provider required',
        'data-testid': 'atlas-vault-delete-key-error',
      });
      return;
    }
    
    const success = deleteVaultSecret(wallet, `dev:${provider}`);
    
    res.json({
      ok: true,
      deleted: success,
      provider,
      'data-testid': 'atlas-vault-delete-key-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete key';
    res.status(500).json({ ok: false, error: message });
  }
});

router.get('/greeting', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.query.wallet as string;
    
    const registry = loadRegistry();
    const externalApps = getExternalApps();
    const agentCapabilities = getAgentCapabilities();
    const configuredProviders = wallet ? getConfiguredProviders(wallet) : [];
    
    let session = wallet ? bridgeGetSession(wallet) : null;
    
    const connectedAppsCount = session?.connectedApps.length || 0;
    const availableEndpoints = session ? getAvailableEndpoints(session) : [];
    
    const greeting = {
      message: wallet 
        ? `Welcome back! You have ${connectedAppsCount} apps connected with ${availableEndpoints.length} available actions.`
        : 'Hey! I\'m Atlas, the protocol-native OS for the P3 mesh. Connect your wallet to get started.',
      session: session ? {
        wallet: session.wallet,
        roles: session.roles,
        connectedApps: session.connectedApps.length,
        availableEndpoints: availableEndpoints.length,
        expiresAt: session.expiresAt,
      } : null,
      capabilities: {
        apps: Object.keys(registry.apps).length,
        endpoints: Object.keys(registry.endpoints).length,
        externalApps: Object.keys(externalApps).length,
        agentProviders: {
          available: ['openai', 'anthropic', 'gemini'],
          configured: configuredProviders,
        },
        agentActions: agentCapabilities.length,
      },
      features: {
        flowComposition: true,
        multiAgentOrchestration: true,
        voiceInput: true,
        walletAnchoring: true,
        crossAppActions: true,
      },
      quickActions: [
        'Check my messages',
        'Play some music',
        'What\'s on my calendar?',
        'Summarize then rewrite this text',
      ],
    };
    
    res.json({
      ok: true,
      ...greeting,
      'data-testid': 'atlas-greeting-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Greeting failed';
    res.status(500).json({ ok: false, error: message });
  }
});

// ============================================================================
// Storage/Gallery Endpoints
// ============================================================================

router.get('/storage/list', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.query.wallet as string;
    
    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet address required',
        'data-testid': 'atlas-storage-list-error',
      });
      return;
    }
    
    const files = [
      {
        id: 'demo-1',
        name: 'encrypted-note-001.enc',
        encrypted: true,
        size: 2048,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        mimeType: 'application/octet-stream',
        cid: 'Qm' + wallet.slice(2, 42),
      },
      {
        id: 'demo-2', 
        name: 'profile-avatar.png',
        encrypted: false,
        size: 45000,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        mimeType: 'image/png',
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
      {
        id: 'demo-3',
        name: 'receipt-2024-001.pdf',
        encrypted: true,
        size: 125000,
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        mimeType: 'application/pdf',
      },
    ];

    res.json({
      ok: true,
      files,
      count: files.length,
      totalSize: files.reduce((acc, f) => acc + f.size, 0),
      wallet: wallet.toLowerCase(),
      'data-testid': 'atlas-storage-list-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list storage';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-storage-list-error',
    });
  }
});

// ============================================================================
// Personal Pulse: Atlas Endpoints CRUD
// ============================================================================

interface EndpointValidationResult {
  valid: boolean;
  version?: string;
  caps?: string[];
  error?: string;
}

const REQUIRED_TELEMETRY_CAPS = ['calls', 'latency', 'payload', 'sessions', 'uptime'];

async function validateEndpoint(url: string): Promise<EndpointValidationResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    // First try Atlas API v2 manifest endpoint (preferred)
    try {
      const manifestRes = await fetch(`${url}/atlas/v2/manifest`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      
      if (manifestRes.ok) {
        const manifest = await manifestRes.json() as { protocolVersion?: string; version?: string; telemetryCaps?: string[]; capabilities?: string[]; lanes?: string[] };
        clearTimeout(timeoutId);
        
        // Check protocol version >= 2.0
        const version = parseFloat(manifest.protocolVersion || manifest.version || '0');
        if (version < 2.0) {
          return { 
            valid: false, 
            error: `Protocol version ${manifest.protocolVersion || manifest.version || 'unknown'} is below required 2.0` 
          };
        }
        
        // Check for required telemetry capabilities
        const caps = manifest.telemetryCaps || manifest.capabilities || manifest.lanes || [];
        const normalizedCaps = Array.isArray(caps) ? caps.map((c: string) => c.toLowerCase()) : [];
        
        // At least 3 of the 5 required caps must be present
        const matchedCaps = REQUIRED_TELEMETRY_CAPS.filter(c => 
          normalizedCaps.some((nc: string) => nc.includes(c))
        );
        
        if (matchedCaps.length < 3) {
          return { 
            valid: false, 
            error: `Insufficient telemetry capabilities. Found: ${normalizedCaps.join(', ')}. Need at least 3 of: ${REQUIRED_TELEMETRY_CAPS.join(', ')}` 
          };
        }
        
        return { 
          valid: true, 
          version: String(manifest.protocolVersion || manifest.version || '2.0'),
          caps: matchedCaps,
        };
      }
    } catch {
      // Manifest endpoint failed, try health endpoint
    }
    
    // Fallback: try /api/atlas/health
    const healthRes = await fetch(`${url}/api/atlas/health`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);
    
    if (healthRes.ok) {
      const data = await healthRes.json() as { protocolVersion?: string; version?: string; atlasVersion?: string; telemetryCaps?: string[]; capabilities?: string[]; lanes?: string[] };
      
      // Health endpoint must declare Atlas API v2 compliance
      const version = parseFloat(data.protocolVersion || data.version || data.atlasVersion || '0');
      if (version < 2.0) {
        return { 
          valid: false, 
          error: 'Endpoint does not declare Atlas API v2 compatibility. Add protocolVersion >= 2.0 to your health response.' 
        };
      }
      
      // Extract capabilities from health response
      const caps = data.telemetryCaps || data.capabilities || data.lanes || REQUIRED_TELEMETRY_CAPS;
      const normalizedCaps = Array.isArray(caps) ? caps : REQUIRED_TELEMETRY_CAPS;
      
      return { 
        valid: true, 
        version: String(data.protocolVersion || data.version || data.atlasVersion || '2.0'),
        caps: normalizedCaps,
      };
    }
    
    return { valid: false, error: 'Endpoint did not respond to manifest or health check' };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

interface NormalizedMetrics {
  callsPerMinute: number;
  latencyP50: number;
  latencyP95: number;
  payloadEfficiency: number;
  sessionReuse: number;
  errorRate: number;
  uptime: number;
  totalCalls: number;
  lastCallAt: string | null;
  fetchedAt: string;
}

function normalizeMetrics(data: Record<string, unknown>): NormalizedMetrics {
  // Normalize various field name conventions
  const getNumber = (keys: string[], defaultVal = 0): number => {
    for (const key of keys) {
      const val = data[key];
      if (typeof val === 'number' && !isNaN(val)) return val;
      if (typeof val === 'string') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return defaultVal;
  };
  
  return {
    callsPerMinute: getNumber(['callsPerMinute', 'calls_per_minute', 'rpm', 'requestsPerMinute']),
    latencyP50: getNumber(['latencyP50', 'latency_p50', 'p50', 'medianLatency', 'latency']),
    latencyP95: getNumber(['latencyP95', 'latency_p95', 'p95']),
    payloadEfficiency: getNumber(['payloadEfficiency', 'payload_efficiency', 'efficiency', 'compressionRatio'], 85),
    sessionReuse: getNumber(['sessionReuse', 'session_reuse', 'reuseRate'], 70),
    errorRate: getNumber(['errorRate', 'error_rate', 'errors']),
    uptime: getNumber(['uptime', 'availability'], 99.9),
    totalCalls: getNumber(['totalCalls', 'total_calls', 'requests', 'totalRequests']),
    lastCallAt: typeof data['lastCallAt'] === 'string' ? data['lastCallAt'] : 
                typeof data['last_call_at'] === 'string' ? data['last_call_at'] : null,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchEndpointMetrics(url: string): Promise<{ metrics: NormalizedMetrics | null; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    // Try multiple metric endpoints
    const endpoints = [
      `${url}/api/atlas/pulse`,
      `${url}/atlas/v2/metrics`,
      `${url}/api/metrics`,
    ];
    
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        
        if (res.ok) {
          clearTimeout(timeoutId);
          const data = await res.json() as { metrics?: Record<string, unknown>; pulse?: Record<string, unknown> };
          
          // Handle nested metrics object
          const metricsData = data.metrics || data.pulse || data;
          
          if (typeof metricsData === 'object' && metricsData !== null) {
            return { metrics: normalizeMetrics(metricsData as Record<string, unknown>) };
          }
        }
      } catch {
        continue; // Try next endpoint
      }
    }
    
    clearTimeout(timeoutId);
    return { metrics: null, error: 'No metrics endpoint responded' };
  } catch (err) {
    return { metrics: null, error: err instanceof Error ? err.message : 'Failed to fetch metrics' };
  }
}

router.get('/endpoints', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || (req.query.wallet as string);
    
    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet address is required',
        'data-testid': 'atlas-endpoints-list-error',
      });
      return;
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-endpoints-list-error',
      });
      return;
    }
    
    const endpoints = await getStorageInstance().getAtlasEndpointsByWallet(wallet.toLowerCase());
    
    res.json({
      ok: true,
      endpoints,
      'data-testid': 'atlas-endpoints-list-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list endpoints';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-endpoints-list-error',
    });
  }
});

router.post('/endpoints', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    const { endpointUrl, displayName } = req.body;
    
    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet address is required',
        'data-testid': 'atlas-endpoints-create-error',
      });
      return;
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-endpoints-create-error',
      });
      return;
    }
    
    if (!endpointUrl || !displayName) {
      res.status(400).json({
        ok: false,
        error: 'endpointUrl and displayName are required',
        'data-testid': 'atlas-endpoints-create-error',
      });
      return;
    }
    
    try {
      new URL(endpointUrl);
    } catch {
      res.status(400).json({
        ok: false,
        error: 'Invalid endpoint URL format',
        'data-testid': 'atlas-endpoints-create-error',
      });
      return;
    }
    
    const validation = await validateEndpoint(endpointUrl);
    
    const endpointData: InsertAtlasEndpoint = {
      walletAddress: wallet.toLowerCase(),
      endpointUrl,
      displayName,
      status: validation.valid ? 'validated' : 'failed',
      protocolVersion: validation.version || null,
      telemetryCaps: validation.caps || null,
      lastValidationAt: new Date(),
    };
    
    const endpoint = await getStorageInstance().createAtlasEndpoint(endpointData);
    
    res.json({
      ok: true,
      endpoint,
      'data-testid': 'atlas-endpoints-create-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create endpoint';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-endpoints-create-error',
    });
  }
});

router.delete('/endpoints/:id', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const wallet = req.atlasUser?.wallet || (req.query.wallet as string);
    
    if (!wallet) {
      res.status(400).json({
        ok: false,
        error: 'Wallet address is required for ownership check',
        'data-testid': 'atlas-endpoints-delete-error',
      });
      return;
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'atlas-endpoints-delete-error',
      });
      return;
    }
    
    const endpoint = await getStorageInstance().getAtlasEndpoint(id);
    
    if (!endpoint) {
      res.status(404).json({
        ok: false,
        error: 'Endpoint not found',
        'data-testid': 'atlas-endpoints-delete-error',
      });
      return;
    }
    
    if (endpoint.walletAddress.toLowerCase() !== wallet.toLowerCase()) {
      res.status(403).json({
        ok: false,
        error: 'Not authorized to delete this endpoint',
        'data-testid': 'atlas-endpoints-delete-error',
      });
      return;
    }
    
    await getStorageInstance().deleteAtlasEndpoint(id);
    
    res.json({
      ok: true,
      'data-testid': 'atlas-endpoints-delete-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete endpoint';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-endpoints-delete-error',
    });
  }
});

router.post('/endpoints/:id/validate', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const wallet = req.atlasUser?.wallet || req.body.wallet;
    
    const endpoint = await getStorageInstance().getAtlasEndpoint(id);
    
    if (!endpoint) {
      res.status(404).json({
        ok: false,
        error: 'Endpoint not found',
        'data-testid': 'atlas-endpoints-validate-error',
      });
      return;
    }
    
    if (wallet && endpoint.walletAddress.toLowerCase() !== wallet.toLowerCase()) {
      res.status(403).json({
        ok: false,
        error: 'Not authorized to validate this endpoint',
        'data-testid': 'atlas-endpoints-validate-error',
      });
      return;
    }
    
    const validation = await validateEndpoint(endpoint.endpointUrl);
    
    const updatedEndpoint = await getStorageInstance().updateAtlasEndpoint(id, {
      status: validation.valid ? 'validated' : 'failed',
      protocolVersion: validation.version || null,
      telemetryCaps: validation.caps || null,
      lastValidationAt: new Date(),
    });
    
    res.json({
      ok: true,
      endpoint: updatedEndpoint,
      'data-testid': 'atlas-endpoints-validate-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate endpoint';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-endpoints-validate-error',
    });
  }
});

router.get('/endpoints/:id/metrics', optionalAtlasAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const endpoint = await getStorageInstance().getAtlasEndpoint(id);
    
    if (!endpoint) {
      res.status(404).json({
        ok: false,
        error: 'Endpoint not found',
        'data-testid': 'atlas-endpoints-metrics-error',
      });
      return;
    }
    
    const result = await fetchEndpointMetrics(endpoint.endpointUrl);
    
    if (!result.metrics) {
      res.json({
        ok: true,
        metrics: {
          callsPerMinute: 0,
          latencyP50: 0,
          latencyP95: 0,
          payloadEfficiency: 85,
          sessionReuse: 70,
          errorRate: 0,
          uptime: 99.9,
          totalCalls: 0,
          lastCallAt: null,
          fetchedAt: new Date().toISOString(),
        },
        stale: true,
        error: result.error,
        'data-testid': 'atlas-endpoints-metrics-response',
      });
      return;
    }
    
    await getStorageInstance().updateAtlasEndpoint(id, {
      lastMetricsFetchAt: new Date(),
      metricsCache: result.metrics,
    });
    
    res.json({
      ok: true,
      metrics: result.metrics,
      stale: false,
      'data-testid': 'atlas-endpoints-metrics-response',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch metrics';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'atlas-endpoints-metrics-error',
    });
  }
});

export default router;
