/**
 * Session Handshake Controller
 * 
 * Handles session initialization for Atlas API 2.0:
 * - POST /v1/session/handshake - Creates new session
 * - Accepts device capabilities (hls, dash, epub, pdf, iframe support)
 * - Generates sessionId (UUID)
 * - Returns lane URLs for manifests, access, receipts
 * - Returns dictionary version for compression
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { priorityScheduler, type LaneType } from './priority';
import { createBaseDictionary, getDictionarySeed, clearSessionDictionary } from '../encoding/dictionary';

export const handshakeRouter = Router();

export interface DeviceCapabilities {
  hls: boolean;
  dash: boolean;
  epub: boolean;
  pdf: boolean;
  iframe: boolean;
  webrtc?: boolean;
  drm?: {
    widevine?: boolean;
    fairplay?: boolean;
    playready?: boolean;
  };
  codecs?: {
    h264?: boolean;
    h265?: boolean;
    vp9?: boolean;
    av1?: boolean;
  };
  screen?: {
    width?: number;
    height?: number;
    dpr?: number;
  };
  encoding?: {
    protobuf?: boolean;
    msgpack?: boolean;
    json?: boolean;
  };
}

export interface SessionLanes {
  manifests: string;
  access: string;
  receipts: string;
}

export type EncodingMode = 'protobuf' | 'msgpack' | 'json';

export interface SessionDictionary {
  version: number;
  seed: Record<string, number>;
}

export interface HandshakeResponse {
  sessionId: string;
  laneUrls: SessionLanes;
  dictVersion: string;
  dictionarySeed: Record<string, number>;
  device: DeviceCapabilities;
  encoding: EncodingMode;
  serverTime: number;
  ttlSeconds: number;
  protocol: {
    version: string;
    compression: boolean;
    encoding: EncodingMode;
    keepAliveMs: number;
  };
}

export interface Session {
  id: string;
  createdAt: number;
  expiresAt: number;
  capabilities: DeviceCapabilities;
  lanes: SessionLanes;
  wallet?: string;
  userAgent?: string;
  ip?: string;
  lastActivity: number;
  connectionState: 'pending' | 'active' | 'closed';
  sseConnections: Set<LaneType>;
  encoding: EncodingMode;
  dictionary: SessionDictionary;
}

const SESSION_TTL_SECONDS = 3600; // 1 hour
const DICTIONARY_VERSION = '2024.12.01';
const PROTOCOL_VERSION = '2.0.0';
const KEEP_ALIVE_MS = 30000;

const sessions = new Map<string, Session>();

export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);
  if (session && session.expiresAt > Date.now()) {
    return session;
  }
  if (session) {
    sessions.delete(sessionId);
    priorityScheduler.unregisterSession(sessionId);
  }
  return undefined;
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values()).filter(s => s.expiresAt > Date.now());
}

export function updateSessionActivity(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
    session.expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  }
}

export function setSessionConnectionState(sessionId: string, state: Session['connectionState']): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.connectionState = state;
  }
}

export function addSSEConnection(sessionId: string, laneType: LaneType): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.sseConnections.add(laneType);
    session.connectionState = 'active';
    updateSessionActivity(sessionId);
  }
}

export function removeSSEConnection(sessionId: string, laneType: LaneType): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.sseConnections.delete(laneType);
    if (session.sseConnections.size === 0) {
      session.connectionState = 'pending';
    }
  }
}

export function closeSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.connectionState = 'closed';
    sessions.delete(sessionId);
    priorityScheduler.unregisterSession(sessionId);
    clearSessionDictionary(sessionId);
    console.log(`[SessionHandshake] Session closed: ${sessionId}`);
  }
}

export function createSession(deviceCaps: DeviceCapabilities, options?: {
  wallet?: string;
  userAgent?: string;
  ip?: string;
  baseUrl?: string;
}): Session {
  const sessionId = randomUUID();
  const now = Date.now();
  const baseUrl = options?.baseUrl || 'https://localhost:5000';
  const lanes = buildLaneUrls(sessionId, baseUrl);
  
  const encoding = negotiateEncoding(deviceCaps.encoding);
  const dict = createBaseDictionary();
  const dictionarySeed = getDictionarySeed(dict);

  const session: Session = {
    id: sessionId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
    capabilities: deviceCaps,
    lanes,
    wallet: options?.wallet,
    userAgent: options?.userAgent,
    ip: options?.ip,
    lastActivity: now,
    connectionState: 'pending',
    sseConnections: new Set(),
    encoding,
    dictionary: {
      version: dictionarySeed.version,
      seed: dictionarySeed.entries,
    },
  };

  sessions.set(sessionId, session);
  priorityScheduler.registerSession(sessionId);

  console.log(`[SessionHandshake] Session created programmatically: ${sessionId}, encoding: ${encoding}`);
  return session;
}

export function validateSession(sessionId: string): { valid: boolean; session?: Session; error?: string } {
  if (!sessionId) {
    return { valid: false, error: 'Session ID is required' };
  }

  const session = getSession(sessionId);
  
  if (!session) {
    return { valid: false, error: 'Session not found or expired' };
  }

  if (session.connectionState === 'closed') {
    return { valid: false, error: 'Session has been closed' };
  }

  const now = Date.now();
  if (session.expiresAt < now) {
    sessions.delete(sessionId);
    priorityScheduler.unregisterSession(sessionId);
    return { valid: false, error: 'Session has expired' };
  }

  return { valid: true, session };
}

const DeviceCapabilitiesSchema = z.object({
  hls: z.boolean().default(true),
  dash: z.boolean().default(false),
  epub: z.boolean().default(true),
  pdf: z.boolean().default(true),
  iframe: z.boolean().default(true),
  webrtc: z.boolean().optional(),
  drm: z.object({
    widevine: z.boolean(),
    fairplay: z.boolean(),
    playready: z.boolean(),
  }).optional(),
  codecs: z.object({
    h264: z.boolean(),
    h265: z.boolean(),
    vp9: z.boolean(),
    av1: z.boolean(),
  }).optional(),
  screen: z.object({
    width: z.number(),
    height: z.number(),
    dpr: z.number(),
  }).optional(),
  encoding: z.object({
    protobuf: z.boolean().optional(),
    msgpack: z.boolean().optional(),
    json: z.boolean().optional(),
  }).optional(),
});

function negotiateEncoding(caps?: { protobuf?: boolean; msgpack?: boolean; json?: boolean }): EncodingMode {
  if (caps?.protobuf) return 'protobuf';
  if (caps?.msgpack) return 'msgpack';
  return 'json';
}

const HandshakeRequestSchema = z.object({
  capabilities: DeviceCapabilitiesSchema,
  wallet: z.string().optional(),
  resumeSessionId: z.string().uuid().optional(),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function buildLaneUrls(sessionId: string, baseUrl: string): SessionLanes {
  const base = baseUrl.replace(/\/$/, '');
  return {
    manifests: `${base}/v1/session/${sessionId}/lane/manifests`,
    access: `${base}/v1/session/${sessionId}/lane/access`,
    receipts: `${base}/v1/session/${sessionId}/lane/receipts`,
  };
}

function getBaseUrl(req: Request): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  return `${protocol}://${host}`;
}

handshakeRouter.post('/handshake', (req: Request, res: Response) => {
  try {
    const parseResult = HandshakeRequestSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid handshake request',
        details: parseResult.error.errors,
      });
    }

    const { capabilities: rawCaps, wallet, resumeSessionId } = parseResult.data;

    const capabilities: DeviceCapabilities = {
      hls: rawCaps.hls ?? true,
      dash: rawCaps.dash ?? false,
      epub: rawCaps.epub ?? true,
      pdf: rawCaps.pdf ?? true,
      iframe: rawCaps.iframe ?? true,
      webrtc: rawCaps.webrtc,
      drm: rawCaps.drm,
      codecs: rawCaps.codecs,
      screen: rawCaps.screen,
      encoding: rawCaps.encoding,
    };

    if (resumeSessionId) {
      const existingSession = getSession(resumeSessionId);
      if (existingSession && existingSession.connectionState !== 'closed') {
        updateSessionActivity(resumeSessionId);
        
        const response: HandshakeResponse = {
          sessionId: resumeSessionId,
          laneUrls: existingSession.lanes,
          dictVersion: DICTIONARY_VERSION,
          dictionarySeed: existingSession.dictionary.seed,
          device: existingSession.capabilities,
          encoding: existingSession.encoding,
          serverTime: Date.now(),
          ttlSeconds: SESSION_TTL_SECONDS,
          protocol: {
            version: PROTOCOL_VERSION,
            compression: true,
            encoding: existingSession.encoding,
            keepAliveMs: KEEP_ALIVE_MS,
          },
        };

        console.log(`[SessionHandshake] Session resumed: ${resumeSessionId}, encoding: ${existingSession.encoding}`);
        return res.json(response);
      }
    }

    const sessionId = randomUUID();
    const now = Date.now();
    const baseUrl = getBaseUrl(req);
    const lanes = buildLaneUrls(sessionId, baseUrl);
    
    const encoding = negotiateEncoding(capabilities.encoding);
    const dict = createBaseDictionary();
    const dictionarySeed = getDictionarySeed(dict);

    const session: Session = {
      id: sessionId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
      capabilities,
      lanes,
      wallet,
      userAgent: req.headers['user-agent'],
      ip: getClientIp(req),
      lastActivity: now,
      connectionState: 'pending',
      sseConnections: new Set(),
      encoding,
      dictionary: {
        version: dictionarySeed.version,
        seed: dictionarySeed.entries,
      },
    };

    sessions.set(sessionId, session);
    priorityScheduler.registerSession(sessionId);

    const response: HandshakeResponse = {
      sessionId,
      laneUrls: lanes,
      dictVersion: DICTIONARY_VERSION,
      dictionarySeed: dictionarySeed.entries,
      device: capabilities,
      encoding,
      serverTime: now,
      ttlSeconds: SESSION_TTL_SECONDS,
      protocol: {
        version: PROTOCOL_VERSION,
        compression: true,
        encoding,
        keepAliveMs: KEEP_ALIVE_MS,
      },
    };

    console.log(`[SessionHandshake] New session created: ${sessionId}`, {
      wallet: wallet ? `${wallet.slice(0, 6)}...` : 'none',
      encoding,
      device: {
        hls: capabilities.hls,
        dash: capabilities.dash,
        epub: capabilities.epub,
        pdf: capabilities.pdf,
      },
    });

    res.status(201).json(response);
  } catch (error: any) {
    console.error('[SessionHandshake] Handshake error:', error);
    res.status(500).json({
      error: 'Handshake failed',
      message: error.message,
    });
  }
});

handshakeRouter.get('/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const priorities = priorityScheduler.getSessionPriorities(sessionId);

  res.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    ttlRemaining: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
    connectionState: session.connectionState,
    activeConnections: Array.from(session.sseConnections),
    lastActivity: session.lastActivity,
    lanes: session.lanes,
    priorities,
  });
});

handshakeRouter.post('/heartbeat/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  updateSessionActivity(sessionId);

  res.json({
    sessionId,
    serverTime: Date.now(),
    expiresAt: session.expiresAt,
    ttlRemaining: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
  });
});

handshakeRouter.delete('/close/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  closeSession(sessionId);

  res.json({
    sessionId,
    status: 'closed',
    closedAt: Date.now(),
  });
});

handshakeRouter.get('/stats', (_req: Request, res: Response) => {
  const activeSessions = getAllSessions();
  const priorityStats = priorityScheduler.getStats();

  res.json({
    activeSessions: activeSessions.length,
    sessionsByState: {
      pending: activeSessions.filter(s => s.connectionState === 'pending').length,
      active: activeSessions.filter(s => s.connectionState === 'active').length,
      closed: activeSessions.filter(s => s.connectionState === 'closed').length,
    },
    priorityStats,
    dictionaryVersion: DICTIONARY_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    serverTime: Date.now(),
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
      priorityScheduler.unregisterSession(sessionId);
      console.log(`[SessionHandshake] Session expired and cleaned up: ${sessionId}`);
    }
  }
}, 60000);

export default handshakeRouter;
