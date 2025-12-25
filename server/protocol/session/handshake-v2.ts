/**
 * Atlas API 2.0 - Session Handshake Controller
 * 
 * Handles session initialization with:
 * - 8-lane architecture support
 * - Protobuf-first encoding with msgpack/json fallback
 * - HTTP/3 transport negotiation with HTTP/1.1 fallback
 * - Dictionary token negotiation
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { 
  LaneId, 
  LaneRegistry, 
  ALL_LANE_IDS,
  LANE_NAMES,
  HandshakeRequestV2, 
  HandshakeResponseV2,
  LaneConfig,
  PROTOCOL_VERSION,
  PROTOCOL_FEATURES,
  negotiateTransport,
  negotiateEncoding,
  getDefaultLanes,
  Encoding,
  Transport,
} from './protocol';
import { priorityScheduler, laneIdToType } from './priority';
import { 
  createBaseDictionary, 
  getDictionarySeed, 
  negotiateDictionary,
  getDictionaryAsRecord,
  clearSessionDictionary,
  TokenDictionary,
} from '../encoding/dictionary';
import { transportNegotiator, getTransportHeaders } from '../transport/http3';

export const handshakeRouterV2 = Router();

export interface SessionV2 {
  id: string;
  createdAt: number;
  expiresAt: number;
  wallet?: string;
  transport: Transport;
  lanes: Map<LaneId, { encoding: Encoding; url: string }>;
  dictionary: TokenDictionary;
  connectionState: 'pending' | 'active' | 'closed';
  sseConnections: Set<LaneId>;
  clientInfo?: {
    clientId: string;
    platform?: string;
    version?: string;
  };
}

const SESSION_TTL_SECONDS = 3600;
const sessions = new Map<string, SessionV2>();

export function getSessionV2(sessionId: string): SessionV2 | undefined {
  const session = sessions.get(sessionId);
  if (session && session.expiresAt > Date.now()) {
    return session;
  }
  if (session) {
    sessions.delete(sessionId);
    priorityScheduler.unregisterSession(sessionId);
    clearSessionDictionary(sessionId);
  }
  return undefined;
}

export function getAllSessionsV2(): SessionV2[] {
  return Array.from(sessions.values()).filter(s => s.expiresAt > Date.now());
}

function buildLaneUrls(sessionId: string, baseUrl: string, laneIds: LaneId[]): Map<LaneId, { encoding: Encoding; url: string }> {
  const lanes = new Map<LaneId, { encoding: Encoding; url: string }>();
  
  for (const laneId of laneIds) {
    const spec = LaneRegistry[laneId];
    lanes.set(laneId, {
      encoding: spec.defaultEncoding,
      url: `${baseUrl}/api/protocol/v2/session/${sessionId}/lane/${laneId}/stream`,
    });
  }
  
  return lanes;
}

handshakeRouterV2.post('/v2/session/handshake', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const body = req.body as Partial<HandshakeRequestV2>;
    
    const clientId = body.clientId || 'anonymous';
    const wallet = body.wallet;
    const capabilities = body.capabilities || {
      transports: ['http1'],
      encodings: ['protobuf', 'msgpack', 'json'],
    };
    
    const requestedLanes = capabilities.lanes?.length 
      ? capabilities.lanes 
      : getDefaultLanes();
    
    const validLanes = requestedLanes.filter(id => ALL_LANE_IDS.includes(id));
    
    const transport = negotiateTransport(capabilities.transports || ['http1']);
    
    const dictionary = createBaseDictionary();
    if (capabilities.dictionaryTokens?.length) {
      negotiateDictionary(dictionary, capabilities.dictionaryTokens);
    }
    
    const sessionId = randomUUID();
    const now = Date.now();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const lanes = buildLaneUrls(sessionId, baseUrl, validLanes);
    
    for (const [laneId] of lanes) {
      const spec = LaneRegistry[laneId];
      const encoding = negotiateEncoding(capabilities.encodings || ['json'], spec);
      lanes.get(laneId)!.encoding = encoding;
    }
    
    const session: SessionV2 = {
      id: sessionId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_SECONDS * 1000,
      wallet,
      transport,
      lanes,
      dictionary,
      connectionState: 'pending',
      sseConnections: new Set(),
      clientInfo: {
        clientId,
        platform: body.deviceInfo?.platform,
        version: body.deviceInfo?.version,
      },
    };
    
    sessions.set(sessionId, session);
    priorityScheduler.registerSession(sessionId, validLanes);
    
    const laneConfigs: LaneConfig[] = Array.from(lanes.entries()).map(([id, config]) => ({
      id,
      name: LANE_NAMES[id],
      encoding: config.encoding,
      url: config.url,
    }));
    
    const response: HandshakeResponseV2 = {
      sessionId,
      transport,
      lanes: laneConfigs,
      dictionary: {
        version: `${dictionary.version}`,
        tokens: Array.from(dictionary.tokens.keys()),
        indexMap: getDictionaryAsRecord(dictionary),
      },
      serverTime: now,
      ttlSeconds: SESSION_TTL_SECONDS,
      protocol: {
        version: PROTOCOL_VERSION,
        features: PROTOCOL_FEATURES,
      },
    };
    
    const transportHeaders = getTransportHeaders(transport);
    for (const [key, value] of Object.entries(transportHeaders)) {
      res.setHeader(key, value);
    }
    
    const handshakeMs = Date.now() - startTime;
    res.setHeader('X-Atlas-Handshake-Ms', handshakeMs.toString());
    
    console.log(`[HandshakeV2] Session created: ${sessionId} (${handshakeMs}ms)`);
    console.log(`[HandshakeV2] Transport: ${transport}, Lanes: ${validLanes.length}, Encoding: msgpack-default`);
    
    res.status(200).json(response);
  } catch (error) {
    console.error('[HandshakeV2] Error:', error);
    res.status(500).json({ error: 'Handshake failed' });
  }
});

handshakeRouterV2.get('/v2/session/:sid', (req: Request, res: Response) => {
  const session = getSessionV2(req.params.sid);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }
  
  res.json({
    sessionId: session.id,
    transport: session.transport,
    lanes: Array.from(session.lanes.entries()).map(([id, config]) => ({
      id,
      name: LANE_NAMES[id],
      ...config,
    })),
    state: session.connectionState,
    activeLanes: Array.from(session.sseConnections),
    expiresIn: Math.max(0, session.expiresAt - Date.now()),
  });
});

handshakeRouterV2.delete('/v2/session/:sid', (req: Request, res: Response) => {
  const session = sessions.get(req.params.sid);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  session.connectionState = 'closed';
  sessions.delete(req.params.sid);
  priorityScheduler.unregisterSession(req.params.sid);
  clearSessionDictionary(req.params.sid);
  
  console.log(`[HandshakeV2] Session closed: ${req.params.sid}`);
  res.status(200).json({ closed: true });
});

handshakeRouterV2.get('/v2/protocol/info', (_req: Request, res: Response) => {
  const serverCaps = transportNegotiator.getServerCapabilities();
  
  res.json({
    version: PROTOCOL_VERSION,
    features: PROTOCOL_FEATURES,
    lanes: {
      total: 8,
      names: Object.values(LANE_NAMES),
      registry: ALL_LANE_IDS.map(laneId => ({
        laneId,
        ...LaneRegistry[laneId],
      })),
    },
    transport: {
      available: serverCaps,
      active: 'http1',
      planned: 'http3',
    },
    encoding: {
      default: 'msgpack',
      available: ['msgpack', 'protobuf', 'json'],
    },
    dictionary: {
      baseTokens: 67,
      maxTokens: 256,
      negotiable: true,
    },
  });
});

export function updateSessionActivity(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  }
}

export function addLaneConnection(sessionId: string, laneId: LaneId): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.sseConnections.add(laneId);
    session.connectionState = 'active';
  }
}

export function removeLaneConnection(sessionId: string, laneId: LaneId): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.sseConnections.delete(laneId);
    if (session.sseConnections.size === 0) {
      session.connectionState = 'pending';
    }
  }
}

export { sessions, SESSION_TTL_SECONDS };
