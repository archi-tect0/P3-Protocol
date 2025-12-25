import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { Router, Request, Response, NextFunction } from 'express';
import { verifyMessage } from 'ethers';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { 
  pulseService, 
  handleNodeTaskComplete, 
  getPulseMetrics,
  broadcastNewsUpdate,
  type NodeTaskPayload 
} from '../atlas/services/pulseService';
import { validateSessionToken, startSession as bridgeStartSession } from '../atlas/services/sessionBridge';
import { startPolling, stopPolling } from '../atlas/services/newsService';
import { authService } from '../auth';
import { recordNodeHeartbeat as persistNodeHeartbeat, trackContentServed } from '../atlas/streaming';

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

const PULSE_DIAGNOSTICS_ENABLED = process.env.PULSE_DIAGNOSTICS_ENABLED === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

const diagnosticsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Rate limit exceeded for diagnostic endpoints' },
  keyGenerator: (req: Request): string => `pulse-diag:${getClientIp(req)}`,
});

const nodeTaskRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Rate limit exceeded for node task reports' },
  keyGenerator: (req: Request): string => {
    const nodeId = req.body?.nodeId || 'unknown';
    return `pulse-task:${nodeId}`;
  },
});

function requireDiagnosticsEnabled(req: Request, res: Response, next: NextFunction): void {
  if (IS_PRODUCTION && !PULSE_DIAGNOSTICS_ENABLED) {
    res.status(403).json({
      ok: false,
      error: 'Pulse diagnostics disabled in production',
      hint: 'Set PULSE_DIAGNOSTICS_ENABLED=true to enable',
    });
    return;
  }
  next();
}

function optionalJwtAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = authService.verifyToken(token);
      (req as any).user = decoded;
    } catch {
    }
  }
  next();
}

function requireJwtForSensitiveData(req: Request, res: Response, next: NextFunction): void {
  if (!IS_PRODUCTION) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      ok: false,
      error: 'Authentication required for sensitive metrics in production',
      hint: 'Provide Authorization: Bearer <token> header',
    });
    return;
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({
      ok: false,
      error: 'Invalid or expired authentication token',
    });
  }
}

// Node heartbeat tracking for real metrics
const nodeHeartbeats = new Map<string, { wallet: string; lastSeen: number; tasksCompleted: number; bytesProcessed: number }>();

export function recordNodeHeartbeat(nodeId: string, wallet: string): void {
  const normalizedWallet = wallet.toLowerCase();
  const existing = nodeHeartbeats.get(nodeId);
  nodeHeartbeats.set(nodeId, {
    wallet: normalizedWallet,
    lastSeen: Date.now(),
    tasksCompleted: existing?.tasksCompleted || 0,
    bytesProcessed: existing?.bytesProcessed || 0,
  });
  
  // Also persist to database for metrics (normalized to lowercase)
  persistNodeHeartbeat(normalizedWallet).catch(err => {
    console.error('[Pulse] Failed to persist heartbeat:', err);
  });
}

export function recordNodeTask(nodeId: string, bytesProcessed: number): void {
  const existing = nodeHeartbeats.get(nodeId);
  if (existing) {
    existing.tasksCompleted++;
    existing.bytesProcessed += bytesProcessed;
    existing.lastSeen = Date.now();
    
    // Also persist content served to database with wallet
    if (bytesProcessed > 0) {
      trackContentServed(bytesProcessed, existing.wallet).catch(err => {
        console.error('[Pulse] Failed to persist content served:', err);
      });
    }
  }
}

export function getActiveNodes(): number {
  const now = Date.now();
  const activeThreshold = 60000; // 1 minute
  let count = 0;
  for (const [nodeId, data] of nodeHeartbeats) {
    if (now - data.lastSeen < activeThreshold) {
      count++;
    } else {
      nodeHeartbeats.delete(nodeId);
    }
  }
  return count;
}

export function getNodeStats(): { activeNodes: number; totalTasks: number; totalBytes: number } {
  const now = Date.now();
  const activeThreshold = 60000;
  let activeNodes = 0;
  let totalTasks = 0;
  let totalBytes = 0;
  
  for (const [nodeId, data] of nodeHeartbeats) {
    if (now - data.lastSeen < activeThreshold) {
      activeNodes++;
      totalTasks += data.tasksCompleted;
      totalBytes += data.bytesProcessed;
    }
  }
  
  return { activeNodes, totalTasks, totalBytes };
}

const router = Router();

interface PulseMessage {
  type: 'subscribe' | 'unsubscribe' | 'node:task:complete' | 'node:register' | 'ping';
  data?: unknown;
}

interface NodeSession {
  wallet: string;
  nodeId: string;
  authenticated: boolean;
  messageCount: number;
  lastMessageTime: number;
  pendingTasks: Map<string, { type: string; createdAt: number }>;
}

const nodeSessions = new Map<WebSocket, NodeSession>();
const pendingChallenges = new Map<string, { challenge: string; wallet: string; expiresAt: number }>();
const walletRateLimits = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MESSAGES_PER_MINUTE = 60;
const RATE_LIMIT_CONNECTIONS_PER_WALLET = 3;
const RATE_LIMIT_CHALLENGES_PER_MINUTE = 5;
const CHALLENGE_EXPIRY_MS = 60000;
const TASK_EXPIRY_MS = 300000;

const authenticatedNodesInternal = new Map<string, { wallet: string; nodeId: string; authenticatedAt: number }>();
const challengeRateLimits = new Map<string, { count: number; resetAt: number }>();
const sessionNonces = new Map<WebSocket, string>();

export function registerAuthenticatedNode(nodeId: string, wallet: string): void {
  authenticatedNodesInternal.set(nodeId, { wallet, nodeId, authenticatedAt: Date.now() });
}

function checkChallengeRateLimit(wallet: string): boolean {
  const now = Date.now();
  const limit = challengeRateLimits.get(wallet);
  
  if (!limit || now > limit.resetAt) {
    challengeRateLimits.set(wallet, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_CHALLENGES_PER_MINUTE) {
    return false;
  }
  
  limit.count++;
  return true;
}

function generateChallenge(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateNodeId(): string {
  return `node-${crypto.randomUUID().replace(/-/g, '')}`;
}

function checkRateLimit(wallet: string): boolean {
  const now = Date.now();
  const limit = walletRateLimits.get(wallet);
  
  if (!limit || now > limit.resetAt) {
    walletRateLimits.set(wallet, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_CONNECTIONS_PER_WALLET) {
    return false;
  }
  
  limit.count++;
  return true;
}

function checkMessageRateLimit(session: NodeSession): boolean {
  const now = Date.now();
  
  if (now - session.lastMessageTime > 60000) {
    session.messageCount = 1;
    session.lastMessageTime = now;
    return true;
  }
  
  if (session.messageCount >= RATE_LIMIT_MESSAGES_PER_MINUTE) {
    return false;
  }
  
  session.messageCount++;
  return true;
}

export function attachPulseWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    if (pathname === '/pulse/stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Pulse] New WebSocket connection');
    
    // SECURITY: Do NOT subscribe to broadcasts until authenticated
    // pulseService.subscribe(ws) is called only after successful auth in handleNodeRegistration
    
    nodeSessions.set(ws, {
      wallet: '',
      nodeId: '',
      authenticated: false,
      messageCount: 0,
      lastMessageTime: Date.now(),
      pendingTasks: new Map(),
    });

    ws.on('message', (data: Buffer) => {
      try {
        const session = nodeSessions.get(ws);
        if (session && !checkMessageRateLimit(session)) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Rate limit exceeded. Please slow down.' },
            timestamp: Date.now(),
          }));
          return;
        }
        
        const message: PulseMessage = JSON.parse(data.toString());
        handlePulseMessage(ws, message);
      } catch (error) {
        console.error('[Pulse] Failed to parse message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' },
          timestamp: Date.now(),
        }));
      }
    });

    ws.on('close', () => {
      sessionNonces.delete(ws);
      nodeSessions.delete(ws);
      console.log('[Pulse] WebSocket connection closed');
    });

    ws.on('error', (error) => {
      console.error('[Pulse] WebSocket error:', error);
    });
  });

  console.log('[Pulse] WebSocket server attached on /pulse/stream');
  
  startPolling((articles) => {
    if (articles.length > 0) {
      broadcastNewsUpdate({
        articles,
        source: 'live-polling',
        fetchTimestamp: Date.now()
      });
      console.log(`[Pulse] Broadcast ${articles.length} live articles to ${pulseService.getSubscriberCount()} nodes`);
    }
  }, 60000);
  
  console.log('[Pulse] Live news polling started (60s interval)');
}

function handlePulseMessage(ws: WebSocket, message: PulseMessage): void {
  const session = nodeSessions.get(ws);
  
  switch (message.type) {
    case 'ping':
      // Record heartbeat for authenticated sessions to keep uptime tracking active
      if (session?.authenticated && session.nodeId && session.wallet) {
        recordNodeHeartbeat(session.nodeId, session.wallet);
      }
      ws.send(JSON.stringify({
        type: 'pong',
        data: { serverTime: Date.now() },
        timestamp: Date.now(),
      }));
      break;

    case 'node:register':
      handleNodeRegistration(ws, message.data);
      break;

    case 'node:task:complete':
      if (!session?.authenticated) {
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Not authenticated. Please register first.' },
          timestamp: Date.now(),
        }));
        return;
      }
      
      if (message.data && isValidNodeTaskPayload(message.data)) {
        const taskId = (message.data as NodeTaskPayload & { taskId?: string }).taskId;
        const pendingTask = taskId ? session.pendingTasks.get(taskId) : null;
        
        if (taskId && pendingTask) {
          handleNodeTaskComplete({
            ...message.data as NodeTaskPayload,
            nodeId: session.nodeId,
          });
          session.pendingTasks.delete(taskId);
          
          ws.send(JSON.stringify({
            type: 'task:acknowledged',
            data: { taskId, status: 'completed' },
            timestamp: Date.now(),
          }));
        } else {
          handleNodeTaskComplete({
            ...message.data as NodeTaskPayload,
            nodeId: session.nodeId,
          });
        }
      }
      break;

    case 'subscribe':
      break;

    case 'unsubscribe':
      ws.close(1000, 'Client requested disconnect');
      break;

    default:
      console.log('[Pulse] Unknown message type:', message.type);
  }
}

interface RegistrationData {
  wallet: string;
  signature?: string;
  challenge?: string;
  sessionToken?: string;
}

async function handleNodeRegistration(ws: WebSocket, data: unknown): Promise<void> {
  const session = nodeSessions.get(ws);
  if (!session) return;
  
  if (session.authenticated && session.nodeId) {
    ws.send(JSON.stringify({
      type: 'auth:success',
      data: { 
        nodeId: session.nodeId,
        wallet: session.wallet,
        capabilities: ['validation', 'relay', 'cache'],
        message: 'Already authenticated',
        authMethod: 'existing'
      },
      timestamp: Date.now(),
    }));
    return;
  }
  
  const regData = data as RegistrationData;
  
  if (!regData?.wallet || typeof regData.wallet !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(regData.wallet)) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Invalid wallet address format' },
      timestamp: Date.now(),
    }));
    return;
  }
  
  const wallet = regData.wallet.toLowerCase();
  
  // Session token authentication - works on mobile without MetaMask
  if (regData.sessionToken) {
    if (validateSessionToken(regData.sessionToken, wallet)) {
      // Session token is valid and matches wallet - authenticate directly
      const nodeId = generateNodeId();
      session.wallet = wallet;
      session.nodeId = nodeId;
      session.authenticated = true;
      
      authenticatedNodesInternal.set(nodeId, { wallet, nodeId, authenticatedAt: Date.now() });
      
      // SECURITY: Only subscribe to broadcasts AFTER successful authentication
      pulseService.subscribe(ws);
      
      console.log(`[Pulse] Node authenticated via session token: ${nodeId} (${wallet.slice(0, 10)}...)`);
      
      const sessionMetrics = getPulseMetrics();
      ws.send(JSON.stringify({
        type: 'auth:success',
        data: { 
          nodeId,
          wallet,
          capabilities: ['validation', 'relay', 'cache'],
          message: 'Successfully registered as Atlas node via session',
          authMethod: 'session',
          metrics: {
            connectedNodes: sessionMetrics.activeSubscribers + 1,
            peersConnected: sessionMetrics.activeSubscribers + 1,
            activeStreams: sessionMetrics.articlesCachedByNodes + sessionMetrics.articlesRelayedByNodes,
            bandwidthSaved: sessionMetrics.totalArticlesFetched * 1024,
            contentServedToday: sessionMetrics.totalArticlesFetched * 1024
          }
        },
        timestamp: Date.now(),
      }));
      return;
    } else {
      ws.send(JSON.stringify({
        type: 'auth:error',
        data: { message: 'Invalid or expired session token. Please reconnect your wallet.', code: 'SESSION_INVALID' },
        timestamp: Date.now(),
      }));
      return;
    }
  }
  
  if (!regData.signature) {
    if (!checkChallengeRateLimit(wallet)) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Too many challenge requests. Please wait 1 minute.' },
        timestamp: Date.now(),
      }));
      return;
    }
    
    const sessionNonce = crypto.randomBytes(16).toString('hex');
    sessionNonces.set(ws, sessionNonce);
    
    const challenge = generateChallenge();
    const timestamp = Date.now();
    const challengeMessage = `Atlas Node Registration\n\nWallet: ${wallet}\nChallenge: ${challenge}\nSession: ${sessionNonce}\nTimestamp: ${timestamp}`;
    
    pendingChallenges.set(`${wallet}:${sessionNonce}`, {
      challenge: challengeMessage,
      wallet,
      expiresAt: timestamp + CHALLENGE_EXPIRY_MS,
    });
    
    ws.send(JSON.stringify({
      type: 'auth:challenge',
      data: { challenge: challengeMessage, wallet, nonce: sessionNonce },
      timestamp,
    }));
    return;
  }
  
  const sessionNonce = sessionNonces.get(ws);
  if (!sessionNonce) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'No active challenge session. Please request a new challenge.' },
      timestamp: Date.now(),
    }));
    return;
  }
  
  const challengeKey = `${wallet}:${sessionNonce}`;
  const pending = pendingChallenges.get(challengeKey);
  
  if (!pending || Date.now() > pending.expiresAt) {
    pendingChallenges.delete(challengeKey);
    sessionNonces.delete(ws);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Challenge expired. Please request a new one.' },
      timestamp: Date.now(),
    }));
    return;
  }
  
  try {
    const recoveredAddress = verifyMessage(pending.challenge, regData.signature);
    
    if (recoveredAddress.toLowerCase() !== wallet) {
      ws.send(JSON.stringify({
        type: 'error',
        data: { message: 'Signature verification failed: wallet mismatch' },
        timestamp: Date.now(),
      }));
      return;
    }
    
    pendingChallenges.delete(challengeKey);
    sessionNonces.delete(ws);
    
    const nodeId = generateNodeId();
    session.wallet = wallet;
    session.nodeId = nodeId;
    session.authenticated = true;
    
    authenticatedNodesInternal.set(nodeId, { wallet, nodeId, authenticatedAt: Date.now() });
    recordNodeHeartbeat(nodeId, wallet);
    
    // SECURITY: Only subscribe to broadcasts AFTER successful authentication
    pulseService.subscribe(ws);
    
    // Issue a session token for reconnection
    const bridgeSession = bridgeStartSession(wallet, ['user']);
    
    console.log(`[Pulse] Node authenticated: ${nodeId} (${wallet.slice(0, 10)}...)`);
    
    const currentMetrics = getPulseMetrics();
    ws.send(JSON.stringify({
      type: 'auth:success',
      data: { 
        nodeId,
        wallet,
        sessionToken: bridgeSession.token,
        capabilities: ['validation', 'relay', 'cache'],
        message: 'Successfully registered as Atlas node',
        metrics: {
          connectedNodes: currentMetrics.activeSubscribers + 1,
          peersConnected: currentMetrics.activeSubscribers + 1,
          activeStreams: currentMetrics.articlesCachedByNodes + currentMetrics.articlesRelayedByNodes,
          bandwidthSaved: currentMetrics.totalArticlesFetched * 1024,
          contentServedToday: currentMetrics.totalArticlesFetched * 1024
        }
      },
      timestamp: Date.now(),
    }));
    
  } catch (error) {
    console.error('[Pulse] Signature verification error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Signature verification failed' },
      timestamp: Date.now(),
    }));
  }
}

function isValidNodeTaskPayload(data: unknown): data is NodeTaskPayload {
  if (typeof data !== 'object' || data === null) return false;
  const payload = data as Record<string, unknown>;
  return (
    typeof payload.nodeId === 'string' &&
    (payload.taskType === 'cache' || payload.taskType === 'relay') &&
    typeof payload.articleCount === 'number' &&
    typeof payload.bytesProcessed === 'number'
  );
}

// ============================================================================
// DIAGNOSTIC ENDPOINTS - Protected by environment guard + rate limiting
// SECURITY: Exposes network telemetry - requires PULSE_DIAGNOSTICS_ENABLED in production
// ============================================================================

router.get('/metrics', 
  requireDiagnosticsEnabled,
  diagnosticsRateLimiter,
  requireJwtForSensitiveData,
  (_req: Request, res: Response) => {
    const metrics = getPulseMetrics();
    res.json({ ok: true, metrics });
  }
);

router.get('/status',
  requireDiagnosticsEnabled,
  diagnosticsRateLimiter,
  optionalJwtAuth,
  (req: Request, res: Response) => {
    const metrics = getPulseMetrics();
    const isAuthenticated = !!(req as any).user;
    
    const publicStatus = {
      ok: true,
      status: {
        active: true,
        subscribers: metrics.activeSubscribers,
        lastBroadcast: metrics.lastBroadcastTimestamp,
      },
    };
    
    if (isAuthenticated || !IS_PRODUCTION) {
      res.json({
        ...publicStatus,
        status: {
          ...publicStatus.status,
          metricsWindow: {
            totalFetched: metrics.totalArticlesFetched,
            cached: metrics.articlesCachedByNodes,
            relayed: metrics.articlesRelayedByNodes,
            bandwidthReduction: `${metrics.bandwidthReductionPercent}%`,
          },
        },
      });
    } else {
      res.json(publicStatus);
    }
  }
);

// ============================================================================
// NODE TASK ENDPOINTS - Protected by node authentication + rate limiting
// ============================================================================

router.post('/node/task', nodeTaskRateLimiter, (req: Request, res: Response) => {
  const { nodeId, taskType, articleCount, bytesProcessed, signature, timestamp } = req.body;

  if (!nodeId || !taskType || typeof articleCount !== 'number') {
    return res.status(400).json({ 
      ok: false, 
      error: 'Missing required fields: nodeId, taskType, articleCount' 
    });
  }

  if (taskType !== 'cache' && taskType !== 'relay') {
    return res.status(400).json({ 
      ok: false, 
      error: 'taskType must be "cache" or "relay"' 
    });
  }

  const nodeAuth = authenticatedNodesInternal.get(nodeId);
  if (!nodeAuth) {
    return res.status(401).json({
      ok: false,
      error: 'Node not authenticated. Please connect via WebSocket first.'
    });
  }

  const nodeAge = Date.now() - nodeAuth.authenticatedAt;
  if (nodeAge > 24 * 60 * 60 * 1000) {
    authenticatedNodesInternal.delete(nodeId);
    return res.status(401).json({
      ok: false,
      error: 'Node session expired. Please re-authenticate.'
    });
  }

  // Record the task in our heartbeat tracking
  recordNodeTask(nodeId, bytesProcessed || 0);
  
  handleNodeTaskComplete({
    nodeId,
    taskType,
    articleCount,
    bytesProcessed: bytesProcessed || 0,
  });

  res.json({ ok: true, message: 'Task recorded', nodeId });
});

// Node heartbeat endpoint - requires node authentication
router.post('/node/heartbeat', nodeTaskRateLimiter, (req: Request, res: Response) => {
  const { nodeId, wallet } = req.body;
  
  if (!nodeId || !wallet) {
    return res.status(400).json({ ok: false, error: 'Missing nodeId or wallet' });
  }
  
  const nodeAuth = authenticatedNodesInternal.get(nodeId);
  if (!nodeAuth || nodeAuth.wallet !== wallet.toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'Node not authenticated' });
  }
  
  recordNodeHeartbeat(nodeId, wallet.toLowerCase());
  
  res.json({ ok: true, message: 'Heartbeat recorded', nodeId });
});

// Get node stats endpoint - SECURITY: Exposes network topology data
// Protected by environment guard + rate limiting + optional JWT for full data
router.get('/node/stats',
  requireDiagnosticsEnabled,
  diagnosticsRateLimiter,
  optionalJwtAuth,
  (req: Request, res: Response) => {
    const stats = getNodeStats();
    const isAuthenticated = !!(req as any).user;
    
    if (isAuthenticated || !IS_PRODUCTION) {
      res.json({ ok: true, ...stats });
    } else {
      res.json({ 
        ok: true, 
        activeNodes: stats.activeNodes,
      });
    }
  }
);

export default router;
