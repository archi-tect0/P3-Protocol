/**
 * Atlas API 2.0 - 8-Lane SSE Architecture
 * 
 * Server-Sent Events (SSE) endpoints for all 8 priority lanes:
 * 1. ACCESS - Content decryption keys, authentication
 * 2. MANIFESTS - Content manifests, metadata
 * 3. RECEIPTS - Analytics, ledger receipts
 * 4. MEDIA - Streaming, real-time media chunks
 * 5. COMMERCE - Cart, checkout, payments
 * 6. GOVERNANCE - Votes, proposals, policies
 * 7. NOTIFICATIONS - Push notifications
 * 8. CHAT - Real-time messaging, presence
 */

import { Router, Request, Response } from 'express';
import { LaneId, LaneRegistry, ALL_LANE_IDS, LANE_NAMES } from './protocol';
import { priorityScheduler, laneIdToType, LaneType } from './priority';
import { getCodec, EncodingType } from '../encoding/codecs';
import { getOrCreateSessionDictionary } from '../encoding/dictionary';

export const lanesRouterV2 = Router();

export interface LaneHandler {
  id: LaneId;
  name: string;
  onOpen(ctx: LaneContext): Promise<void>;
  onMessage(ctx: LaneContext, payload: Uint8Array): Promise<Uint8Array | void>;
  onClose(ctx: LaneContext): Promise<void>;
}

export interface LaneContext {
  sessionId: string;
  laneId: LaneId;
  encoding: EncodingType;
  response?: Response;
}

export interface SSEClientV2 {
  sessionId: string;
  laneId: LaneId;
  laneType: LaneType;
  response: Response;
  lastEventId: number;
  connectedAt: number;
  encoding: EncodingType;
}

const sseClients: Map<string, SSEClientV2> = new Map();
let globalEventId = 0;

function getClientKey(sessionId: string, laneId: LaneId): string {
  return `${sessionId}:${laneId}`;
}

function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Atlas-Protocol', '2.0.0');
  res.setHeader('X-Atlas-Lanes', '8');
  res.flushHeaders();
}

const laneHandlers: Map<LaneId, LaneHandler> = new Map();

function createLaneHandler(id: LaneId): LaneHandler {
  const name = LANE_NAMES[id];
  return {
    id,
    name,
    async onOpen(ctx: LaneContext) {
      console.log(`[Lane:${name}] Session ${ctx.sessionId} opened`);
    },
    async onMessage(ctx: LaneContext, payload: Uint8Array) {
      const codec = getCodec(ctx.encoding);
      const decoded = codec.decode(payload);
      console.log(`[Lane:${name}] Message from ${ctx.sessionId}:`, decoded);
      
      const response = { ack: true, lane: name, timestamp: Date.now() };
      return codec.encode(response);
    },
    async onClose(ctx: LaneContext) {
      console.log(`[Lane:${name}] Session ${ctx.sessionId} closed`);
    },
  };
}

for (const laneId of ALL_LANE_IDS) {
  laneHandlers.set(laneId, createLaneHandler(laneId));
}

lanesRouterV2.get('/v2/session/:sid/lane/:laneId/stream', async (req: Request, res: Response) => {
  const { sid, laneId: laneIdStr } = req.params;
  const laneId = parseInt(laneIdStr, 10) as LaneId;
  
  if (!ALL_LANE_IDS.includes(laneId)) {
    return res.status(400).json({ error: 'Invalid lane ID', validLanes: ALL_LANE_IDS });
  }

  const handler = laneHandlers.get(laneId);
  if (!handler) {
    return res.status(404).json({ error: 'Lane handler not found' });
  }

  const clientKey = getClientKey(sid, laneId);
  const existingClient = sseClients.get(clientKey);
  if (existingClient && !existingClient.response.writableEnded) {
    try {
      existingClient.response.end();
    } catch {}
  }

  setupSSEHeaders(res);

  const encoding = (req.query.encoding as EncodingType) || 'msgpack';
  const laneType = laneIdToType(laneId);

  const client: SSEClientV2 = {
    sessionId: sid,
    laneId,
    laneType,
    response: res,
    lastEventId: 0,
    connectedAt: Date.now(),
    encoding,
  };

  sseClients.set(clientKey, client);
  priorityScheduler.registerSession(sid, [laneId]);

  const ctx: LaneContext = { sessionId: sid, laneId, encoding, response: res };
  await handler.onOpen(ctx);

  res.write(`event: open\n`);
  res.write(`id: ${++globalEventId}\n`);
  res.write(`data: ${JSON.stringify({ 
    lane: handler.name, 
    laneId, 
    encoding,
    protocol: '2.0.0',
    features: ['8-lanes', 'msgpack-default', 'http3-architecture']
  })}\n\n`);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }
  }, 30000);

  req.on('close', async () => {
    clearInterval(heartbeat);
    sseClients.delete(clientKey);
    await handler.onClose(ctx);
  });
});

lanesRouterV2.post('/v2/session/:sid/lane/:laneId', async (req: Request, res: Response) => {
  const { sid, laneId: laneIdStr } = req.params;
  const laneId = parseInt(laneIdStr, 10) as LaneId;

  if (!ALL_LANE_IDS.includes(laneId)) {
    return res.status(400).json({ error: 'Invalid lane ID', validLanes: ALL_LANE_IDS });
  }

  const handler = laneHandlers.get(laneId);
  if (!handler) {
    return res.status(404).json({ error: 'Lane handler not found' });
  }

  const encoding = (req.headers['x-atlas-encoding'] as EncodingType) || 'msgpack';
  const ctx: LaneContext = { sessionId: sid, laneId, encoding };

  let payload: Uint8Array;
  if (Buffer.isBuffer(req.body)) {
    payload = new Uint8Array(req.body);
  } else if (typeof req.body === 'object') {
    const codec = getCodec(encoding);
    payload = codec.encode(req.body);
  } else {
    payload = new Uint8Array(0);
  }

  const response = await handler.onMessage(ctx, payload);

  if (!response) {
    return res.status(204).end();
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Atlas-Encoding', encoding);
  res.status(200).end(Buffer.from(response));
});

lanesRouterV2.get('/v2/lanes/registry', (_req: Request, res: Response) => {
  const registry = ALL_LANE_IDS.map(laneId => ({
    laneId,
    ...LaneRegistry[laneId],
  }));
  res.json({
    protocol: '2.0.0',
    totalLanes: 8,
    registry,
  });
});

export function broadcastToLane(laneId: LaneId, event: string, data: unknown): void {
  for (const [key, client] of sseClients) {
    if (client.laneId === laneId && !client.response.writableEnded) {
      try {
        const eventId = ++globalEventId;
        client.response.write(`event: ${event}\n`);
        client.response.write(`id: ${eventId}\n`);
        client.response.write(`data: ${JSON.stringify(data)}\n\n`);
        client.lastEventId = eventId;
      } catch (error) {
        console.error(`[LanesV2] Broadcast error to ${key}:`, error);
      }
    }
  }
}

export function getConnectedClients(): SSEClientV2[] {
  return Array.from(sseClients.values()).filter(c => !c.response.writableEnded);
}

export function getLaneStats(): Record<string, { clients: number; encoding: Record<EncodingType, number> }> {
  const stats: Record<string, { clients: number; encoding: Record<EncodingType, number> }> = {};
  
  for (const laneId of ALL_LANE_IDS) {
    const name = LANE_NAMES[laneId];
    stats[name] = { 
      clients: 0, 
      encoding: { protobuf: 0, msgpack: 0, json: 0 } 
    };
  }

  for (const client of sseClients.values()) {
    if (!client.response.writableEnded) {
      const name = LANE_NAMES[client.laneId];
      stats[name].clients++;
      stats[name].encoding[client.encoding]++;
    }
  }

  return stats;
}

export { laneHandlers };
