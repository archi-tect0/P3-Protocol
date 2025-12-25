/**
 * Session Lane SSE Endpoints
 * 
 * Server-Sent Events (SSE) endpoints for real-time session communication:
 * - GET /v1/session/:sid/lane/manifests - SSE stream for content manifests
 * - GET /v1/session/:sid/lane/access - SSE stream for access/decryption keys (binary frames)
 * - POST /v1/session/:sid/lane/receipts - Fire-and-forget receipt submission
 * 
 * Binary Frame Format (access lane):
 * event: access
 * id: {itemId}
 * data: {base64EncodedAccessFrame}
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getSession,
  updateSessionActivity,
  addSSEConnection,
  removeSSEConnection,
  type Session,
  type EncodingMode,
} from './handshake';
import { priorityScheduler, type LaneType, type FocusSignal } from './priority';
import {
  AccessFrame,
  AccessMode,
  Readiness,
  buildAccessFrame,
  accessFrameToBase64,
  createAccessSSEEvent,
} from '../wire';
import { signFrame, createSignedFrameBundle } from '../signing';
import { 
  encodeManifestFrame, 
  encodeAccessFrame as encodeAccessFrameEnvelope,
  encodeCatalogFrame,
  type FrameEnvelope,
} from '../encoding/frames';
import { getOrCreateSessionDictionary, type TokenDictionary } from '../encoding/dictionary';

export const lanesRouter = Router();

export interface SSEClient {
  sessionId: string;
  laneType: LaneType;
  response: Response;
  lastEventId: number;
  connectedAt: number;
}

export interface LaneEvent {
  id: number;
  type: string;
  data: unknown;
  timestamp: number;
  priority: number;
}

export interface ManifestEvent {
  itemId: string;
  kind: 'hls' | 'dash' | 'epub' | 'pdf';
  url: string;
  metadata?: Record<string, unknown>;
  expiresAt?: number;
}

export interface AccessEvent {
  itemId: string;
  keyId: string;
  encryptedKey?: string;
  algorithm?: string;
  expiresAt: number;
  permissions: string[];
}

export interface ReceiptPayload {
  eventType: 'view' | 'play' | 'pause' | 'seek' | 'complete' | 'download' | 'error';
  itemId: string;
  position?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

const sseClients: Map<string, SSEClient> = new Map();
const eventQueues: Map<string, LaneEvent[]> = new Map();
let globalEventId = 0;

function getClientKey(sessionId: string, laneType: LaneType): string {
  return `${sessionId}:${laneType}`;
}

function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Content-Type, Last-Event-ID');
  res.flushHeaders();
}

function sendSSEEvent(client: SSEClient, event: LaneEvent, session?: Session): void {
  const { response, laneType, sessionId } = client;
  
  if (response.writableEnded) {
    return;
  }

  try {
    const encoding = session?.encoding || 'json';
    
    if (encoding !== 'json' && (event.type === 'manifest' || event.type === 'access' || event.type === 'catalog')) {
      const dictionary = getOrCreateSessionDictionary(sessionId);
      let envelope: FrameEnvelope;
      
      if (event.type === 'manifest') {
        envelope = encodeManifestFrame(event.data, dictionary, encoding);
      } else if (event.type === 'access') {
        envelope = encodeAccessFrameEnvelope(event.data, dictionary, encoding);
      } else {
        const result = encodeCatalogFrame(
          Array.isArray(event.data) ? event.data : [event.data], 
          dictionary, 
          encoding
        );
        envelope = result.envelope;
      }
      
      response.write(`id: ${event.id}\n`);
      response.write(`event: ${event.type}\n`);
      response.write(`data: ${JSON.stringify(envelope)}\n\n`);
    } else {
      response.write(`id: ${event.id}\n`);
      response.write(`event: ${event.type}\n`);
      response.write(`data: ${JSON.stringify(event.data)}\n\n`);
    }
    
    client.lastEventId = event.id;
    updateSessionActivity(sessionId);
  } catch (error) {
    console.error(`[Lanes] Error sending SSE event to ${laneType}:`, error);
  }
}

function sendHeartbeat(client: SSEClient): void {
  if (client.response.writableEnded) {
    return;
  }

  try {
    client.response.write(`: heartbeat ${Date.now()}\n\n`);
  } catch (error) {
    console.error('[Lanes] Error sending heartbeat:', error);
  }
}

function createSSEHandler(laneType: LaneType) {
  return (req: Request, res: Response) => {
    const { sid } = req.params;
    const session = getSession(sid);

    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const clientKey = getClientKey(sid, laneType);

    const existingClient = sseClients.get(clientKey);
    if (existingClient && !existingClient.response.writableEnded) {
      try {
        existingClient.response.end();
      } catch {}
    }

    setupSSEHeaders(res);

    const client: SSEClient = {
      sessionId: sid,
      laneType,
      response: res,
      lastEventId: parseInt(req.headers['last-event-id'] as string) || 0,
      connectedAt: Date.now(),
    };

    sseClients.set(clientKey, client);
    addSSEConnection(sid, laneType);

    const priority = priorityScheduler.getEffectivePriority(sid, laneType);
    
    globalEventId++;
    sendSSEEvent(client, {
      id: globalEventId,
      type: 'connected',
      data: {
        sessionId: sid,
        laneType,
        priority,
        encoding: session.encoding,
        serverTime: Date.now(),
      },
      timestamp: Date.now(),
      priority,
    }, session);

    const queueKey = clientKey;
    const pendingEvents = eventQueues.get(queueKey) || [];
    const missedEvents = pendingEvents.filter(e => e.id > client.lastEventId);
    
    for (const event of missedEvents) {
      sendSSEEvent(client, event, session);
    }

    const heartbeatInterval = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeatInterval);
        return;
      }
      sendHeartbeat(client);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeatInterval);
      sseClients.delete(clientKey);
      removeSSEConnection(sid, laneType);
      console.log(`[Lanes] SSE connection closed: ${clientKey}`);
    });

    req.on('error', (error) => {
      clearInterval(heartbeatInterval);
      sseClients.delete(clientKey);
      removeSSEConnection(sid, laneType);
      console.error(`[Lanes] SSE connection error: ${clientKey}`, error);
    });

    console.log(`[Lanes] SSE connection established: ${clientKey}, priority: ${priority}`);
  };
}

lanesRouter.get('/:sid/lane/manifests', createSSEHandler('manifests'));
lanesRouter.get('/:sid/lane/access', createSSEHandler('access'));

const ReceiptPayloadSchema = z.object({
  eventType: z.enum(['view', 'play', 'pause', 'seek', 'complete', 'download', 'error']),
  itemId: z.string(),
  position: z.number().optional(),
  duration: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.number().optional(),
});

const ReceiptBatchSchema = z.array(ReceiptPayloadSchema).max(50);

lanesRouter.post('/:sid/lane/receipts', (req: Request, res: Response) => {
  const { sid } = req.params;
  const session = getSession(sid);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  let receipts: ReceiptPayload[];
  
  if (Array.isArray(req.body)) {
    const parseResult = ReceiptBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid receipt batch',
        details: parseResult.error.errors,
      });
    }
    receipts = parseResult.data;
  } else {
    const parseResult = ReceiptPayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid receipt payload',
        details: parseResult.error.errors,
      });
    }
    receipts = [parseResult.data];
  }

  updateSessionActivity(sid);

  const processedReceipts = receipts.map(receipt => ({
    ...receipt,
    sessionId: sid,
    receivedAt: Date.now(),
    timestamp: receipt.timestamp || Date.now(),
  }));

  console.log(`[Lanes] Receipts received: ${sid}`, {
    count: processedReceipts.length,
    types: [...new Set(processedReceipts.map(r => r.eventType))],
  });

  res.status(202).json({
    accepted: processedReceipts.length,
    sessionId: sid,
    serverTime: Date.now(),
  });
});

const FocusSignalSchema = z.object({
  laneType: z.enum(['access', 'manifests', 'receipts']),
  isFocused: z.boolean(),
});

lanesRouter.post('/:sid/lane/focus', (req: Request, res: Response) => {
  const { sid } = req.params;
  const session = getSession(sid);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const parseResult = FocusSignalSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid focus signal',
      details: parseResult.error.errors,
    });
  }

  const { laneType, isFocused } = parseResult.data;

  const signal: FocusSignal = {
    sessionId: sid,
    laneType,
    isFocused,
    timestamp: Date.now(),
  };

  priorityScheduler.applyFocusSignal(signal);
  updateSessionActivity(sid);

  const newPriority = priorityScheduler.getEffectivePriority(sid, laneType);

  res.json({
    sessionId: sid,
    laneType,
    isFocused,
    newPriority,
    serverTime: Date.now(),
  });
});

export function publishToLane(
  sessionId: string,
  laneType: LaneType,
  eventType: string,
  data: unknown
): boolean {
  const clientKey = getClientKey(sessionId, laneType);
  const client = sseClients.get(clientKey);
  const session = getSession(sessionId);

  const priority = priorityScheduler.getEffectivePriority(sessionId, laneType);
  
  globalEventId++;
  const event: LaneEvent = {
    id: globalEventId,
    type: eventType,
    data,
    timestamp: Date.now(),
    priority,
  };

  if (!eventQueues.has(clientKey)) {
    eventQueues.set(clientKey, []);
  }
  const queue = eventQueues.get(clientKey)!;
  queue.push(event);
  
  if (queue.length > 100) {
    queue.splice(0, queue.length - 100);
  }

  if (client && !client.response.writableEnded) {
    sendSSEEvent(client, event, session);
    return true;
  }

  return false;
}

export function publishManifest(sessionId: string, manifest: ManifestEvent): boolean {
  return publishToLane(sessionId, 'manifests', 'manifest', manifest);
}

export function publishAccess(sessionId: string, access: AccessEvent): boolean {
  return publishToLane(sessionId, 'access', 'access', access);
}

export interface BinaryAccessFrameOptions {
  itemId: string;
  mode?: 'uri' | 'embed' | 'openweb';
  uri?: string;
  embed?: string;
  openWeb?: string;
  readiness?: 'pending' | 'ready' | 'degraded';
  ttlMs?: number;
  capabilities?: {
    codec?: string;
    segmentMs?: number;
    cors?: boolean;
  };
}

function getAccessModeEnum(mode?: string): AccessMode {
  switch (mode?.toLowerCase()) {
    case 'uri': return AccessMode.URI;
    case 'embed': return AccessMode.EMBED;
    case 'openweb': return AccessMode.OPEN_WEB;
    default: return AccessMode.UNKNOWN;
  }
}

function getReadinessEnum(readiness?: string): Readiness {
  switch (readiness?.toLowerCase()) {
    case 'pending': return Readiness.PENDING;
    case 'ready': return Readiness.READY;
    case 'degraded': return Readiness.DEGRADED;
    default: return Readiness.UNKNOWN;
  }
}

export function publishBinaryAccessFrame(sessionId: string, options: BinaryAccessFrameOptions): boolean {
  const clientKey = getClientKey(sessionId, 'access');
  const client = sseClients.get(clientKey);

  const frame = buildAccessFrame({
    id: options.itemId,
    mode: getAccessModeEnum(options.mode),
    uri: options.uri,
    embed: options.embed,
    openWeb: options.openWeb,
    readiness: getReadinessEnum(options.readiness),
    ttlMs: options.ttlMs,
    capabilities: options.capabilities,
  });

  const { frame: signedFrame, signatureHex } = signFrame(frame);
  const base64Data = accessFrameToBase64(signedFrame);

  const priority = priorityScheduler.getEffectivePriority(sessionId, 'access');
  globalEventId++;

  if (client && !client.response.writableEnded) {
    try {
      client.response.write(`event: access\n`);
      client.response.write(`id: ${options.itemId}\n`);
      client.response.write(`data: ${base64Data}\n\n`);
      
      client.lastEventId = globalEventId;
      updateSessionActivity(sessionId);
      
      console.log(`[Lanes] Binary access frame sent: ${sessionId}/${options.itemId}, sig: ${signatureHex.substring(0, 16)}...`);
      return true;
    } catch (error) {
      console.error(`[Lanes] Error sending binary access frame:`, error);
      return false;
    }
  }

  return false;
}

export function publishSignedAccessFrame(sessionId: string, frame: AccessFrame): boolean {
  const clientKey = getClientKey(sessionId, 'access');
  const client = sseClients.get(clientKey);

  const bundle = createSignedFrameBundle(frame);

  const priority = priorityScheduler.getEffectivePriority(sessionId, 'access');
  globalEventId++;

  if (client && !client.response.writableEnded) {
    try {
      client.response.write(`event: access\n`);
      client.response.write(`id: ${frame.id}\n`);
      client.response.write(`data: ${bundle.base64}\n\n`);
      
      client.lastEventId = globalEventId;
      updateSessionActivity(sessionId);
      
      return true;
    } catch (error) {
      console.error(`[Lanes] Error sending signed access frame:`, error);
      return false;
    }
  }

  return false;
}

export function broadcastBinaryAccessFrame(options: BinaryAccessFrameOptions): number {
  let sentCount = 0;

  const frame = buildAccessFrame({
    id: options.itemId,
    mode: getAccessModeEnum(options.mode),
    uri: options.uri,
    embed: options.embed,
    openWeb: options.openWeb,
    readiness: getReadinessEnum(options.readiness),
    ttlMs: options.ttlMs,
    capabilities: options.capabilities,
  });

  const { frame: signedFrame } = signFrame(frame);
  const base64Data = accessFrameToBase64(signedFrame);

  for (const [key, client] of sseClients.entries()) {
    if (client.laneType === 'access' && !client.response.writableEnded) {
      try {
        client.response.write(`event: access\n`);
        client.response.write(`id: ${options.itemId}\n`);
        client.response.write(`data: ${base64Data}\n\n`);
        
        globalEventId++;
        client.lastEventId = globalEventId;
        updateSessionActivity(client.sessionId);
        sentCount++;
      } catch (error) {
        console.error(`[Lanes] Error broadcasting binary access frame:`, error);
      }
    }
  }

  return sentCount;
}

export function broadcastToLane(laneType: LaneType, eventType: string, data: unknown): number {
  let sentCount = 0;

  for (const [key, client] of sseClients.entries()) {
    if (client.laneType === laneType && !client.response.writableEnded) {
      const session = getSession(client.sessionId);
      const priority = priorityScheduler.getEffectivePriority(client.sessionId, laneType);
      
      globalEventId++;
      const event: LaneEvent = {
        id: globalEventId,
        type: eventType,
        data,
        timestamp: Date.now(),
        priority,
      };

      sendSSEEvent(client, event, session);
      sentCount++;
    }
  }

  return sentCount;
}

// ============================================================================
// ACCESS REQUEST BROKER - Clients request access, broker resolves and streams
// ============================================================================

const accessRequestQueues: Map<string, Set<(itemId: string) => void>> = new Map();

export function subscribeToAccessRequests(
  sessionId: string,
  handler: (itemId: string) => void
): () => void {
  if (!accessRequestQueues.has(sessionId)) {
    accessRequestQueues.set(sessionId, new Set());
  }
  accessRequestQueues.get(sessionId)!.add(handler);
  
  return () => {
    accessRequestQueues.get(sessionId)?.delete(handler);
  };
}

export function requestAccess(sessionId: string, itemId: string): void {
  const handlers = accessRequestQueues.get(sessionId);
  if (handlers) {
    for (const handler of handlers) {
      handler(itemId);
    }
  }
}

const AccessRequestSchema = z.object({
  itemIds: z.array(z.string()).min(1).max(50),
});

lanesRouter.post('/:sid/lane/access/request', async (req: Request, res: Response) => {
  const { sid } = req.params;
  const session = getSession(sid);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const parseResult = AccessRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid access request',
      details: parseResult.error.errors,
    });
  }

  const { itemIds } = parseResult.data;
  
  // Fire access requests - handlers will resolve and stream to SSE lane
  for (const itemId of itemIds) {
    requestAccess(sid, itemId);
  }

  updateSessionActivity(sid);

  // Return immediately - results will stream via SSE
  res.status(202).json({
    accepted: itemIds.length,
    sessionId: sid,
    message: 'Access requests queued for resolution. Results will stream via access lane.',
    serverTime: Date.now(),
  });
});

lanesRouter.get('/:sid/lane/status', (req: Request, res: Response) => {
  const { sid } = req.params;
  const session = getSession(sid);

  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  const laneStatus: Record<LaneType, { connected: boolean; lastEventId: number; priority: number }> = {
    manifests: { connected: false, lastEventId: 0, priority: 0 },
    access: { connected: false, lastEventId: 0, priority: 0 },
    receipts: { connected: false, lastEventId: 0, priority: 0 },
  };

  for (const laneType of ['manifests', 'access', 'receipts'] as LaneType[]) {
    const clientKey = getClientKey(sid, laneType);
    const client = sseClients.get(clientKey);
    
    laneStatus[laneType] = {
      connected: client ? !client.response.writableEnded : false,
      lastEventId: client?.lastEventId || 0,
      priority: priorityScheduler.getEffectivePriority(sid, laneType),
    };
  }

  res.json({
    sessionId: sid,
    lanes: laneStatus,
    serverTime: Date.now(),
  });
});

export function getConnectedClients(): { sessionId: string; laneType: LaneType; connectedAt: number }[] {
  const clients: { sessionId: string; laneType: LaneType; connectedAt: number }[] = [];
  
  for (const client of sseClients.values()) {
    if (!client.response.writableEnded) {
      clients.push({
        sessionId: client.sessionId,
        laneType: client.laneType,
        connectedAt: client.connectedAt,
      });
    }
  }
  
  return clients;
}

export default lanesRouter;
