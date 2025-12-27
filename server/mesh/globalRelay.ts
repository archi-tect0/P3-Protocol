import { Router, Request, Response } from 'express';
import { verifyMessage, getAddress } from 'ethers';

const router = Router();

interface NodeManifest {
  nodeId: string;
  wallet: string;
  signature: string;
  foundationLaneVersion: string;
  customLanes: string[];
  capabilities: string[];
  endpoint: string;
  timestamp: number;
  lastSeen?: number;
}

interface RelayMessage {
  target: string;
  lane: number;
  payload: any;
  timestamp: number;
  from?: string;
}

const globalNodes = new Map<string, NodeManifest>();
const relayQueue = new Map<string, RelayMessage[]>();
let totalRelays = 0;
const startTime = Date.now();

const FOUNDATION_LANES = {
  HANDSHAKE: 0,
  IDENTITY: 1,
  KEEPALIVE: 2,
  TELEMETRY: 3,
};

function cleanupStaleNodes() {
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000;
  
  for (const [nodeId, manifest] of globalNodes.entries()) {
    if (now - (manifest.lastSeen || manifest.timestamp) > staleThreshold) {
      globalNodes.delete(nodeId);
      relayQueue.delete(nodeId);
    }
  }
}

setInterval(cleanupStaleNodes, 60000);

const MAX_PAYLOAD_SIZE = 64 * 1024;
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SIGNATURE_REGEX = /^0x[a-fA-F0-9]{130,132}$/;
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

function buildSigningMessage(nodeId: string, wallet: string, timestamp: number): string {
  return `p3-global-relay:${nodeId}:${wallet.toLowerCase()}:${timestamp}`;
}

function validateSignature(manifest: NodeManifest): { valid: boolean; error?: string } {
  try {
    const now = Date.now();
    if (Math.abs(now - manifest.timestamp) > MAX_TIMESTAMP_DRIFT_MS) {
      return { valid: false, error: 'Timestamp expired or too far in future' };
    }

    const message = buildSigningMessage(manifest.nodeId, manifest.wallet, manifest.timestamp);
    const recoveredAddress = verifyMessage(message, manifest.signature);
    const normalizedClaimed = getAddress(manifest.wallet);
    const normalizedRecovered = getAddress(recoveredAddress);

    if (normalizedClaimed !== normalizedRecovered) {
      return { valid: false, error: 'Signature does not match claimed wallet' };
    }

    return { valid: true };
  } catch (error) {
    console.error('[GlobalRelay] Signature validation error:', error);
    return { valid: false, error: 'Invalid signature format or verification failed' };
  }
}

router.post('/register', (req: Request, res: Response) => {
  try {
    const manifest = req.body as NodeManifest;
    
    if (!manifest.nodeId || !manifest.wallet || !manifest.signature) {
      res.status(400).json({
        ok: false,
        error: 'Missing required fields: nodeId, wallet, signature',
        'data-testid': 'mesh-register-error',
      });
      return;
    }
    
    if (!WALLET_REGEX.test(manifest.wallet)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid wallet address format',
        'data-testid': 'mesh-register-error',
      });
      return;
    }
    
    if (!SIGNATURE_REGEX.test(manifest.signature)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid signature format',
        'data-testid': 'mesh-register-error',
      });
      return;
    }
    
    if (!manifest.foundationLaneVersion?.startsWith('1.')) {
      res.status(400).json({
        ok: false,
        error: 'Incompatible foundation lane version. Required: 1.x',
        'data-testid': 'mesh-register-error',
      });
      return;
    }
    
    if (manifest.nodeId.length > 64 || manifest.endpoint?.length > 256) {
      res.status(400).json({
        ok: false,
        error: 'Field length exceeds maximum',
        'data-testid': 'mesh-register-error',
      });
      return;
    }

    const signatureValidation = validateSignature(manifest);
    if (!signatureValidation.valid) {
      res.status(403).json({
        ok: false,
        error: signatureValidation.error,
        'data-testid': 'mesh-register-error',
      });
      return;
    }
    
    manifest.lastSeen = Date.now();
    globalNodes.set(manifest.nodeId, manifest);
    
    console.log(`[GlobalRelay] Node registered: ${manifest.nodeId} (${manifest.wallet.slice(0, 10)}...)`);
    
    res.json({
      ok: true,
      nodeId: manifest.nodeId,
      registeredAt: Date.now(),
      peersAvailable: globalNodes.size,
      foundationLanes: FOUNDATION_LANES,
      'data-testid': 'mesh-register-response',
    });
  } catch (error) {
    console.error('[GlobalRelay] Registration error:', error);
    res.status(500).json({
      ok: false,
      error: 'Registration failed',
      'data-testid': 'mesh-register-error',
    });
  }
});

router.post('/unregister', (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    for (const [nodeId, manifest] of globalNodes.entries()) {
      if (manifest.wallet.toLowerCase() === wallet?.toLowerCase()) {
        globalNodes.delete(nodeId);
        relayQueue.delete(nodeId);
        console.log(`[GlobalRelay] Node unregistered: ${nodeId}`);
      }
    }
    
    res.json({
      ok: true,
      message: 'Unregistered from global network',
      'data-testid': 'mesh-unregister-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Unregistration failed',
      'data-testid': 'mesh-unregister-error',
    });
  }
});

router.get('/peers', (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    const peers: NodeManifest[] = [];
    
    for (const manifest of globalNodes.values()) {
      if (manifest.wallet.toLowerCase() !== wallet?.toLowerCase()) {
        peers.push({
          ...manifest,
          signature: '***',
        });
      }
    }
    
    res.json({
      ok: true,
      peers,
      total: peers.length,
      foundationLaneVersion: '1.0.0',
      'data-testid': 'mesh-peers-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch peers',
      'data-testid': 'mesh-peers-error',
    });
  }
});

router.post('/relay', (req: Request, res: Response) => {
  try {
    const payloadSize = JSON.stringify(req.body).length;
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      res.status(400).json({
        ok: false,
        error: `Payload exceeds maximum size of ${MAX_PAYLOAD_SIZE} bytes`,
        'data-testid': 'mesh-relay-error',
      });
      return;
    }
    
    const message = req.body as RelayMessage;
    const wallet = req.headers['x-wallet-address'] as string;
    
    if (!message.target || message.lane === undefined) {
      res.status(400).json({
        ok: false,
        error: 'Missing target or lane',
        'data-testid': 'mesh-relay-error',
      });
      return;
    }
    
    const lane = Number(message.lane);
    if (!Number.isInteger(lane) || lane < 0 || lane > 3) {
      res.status(400).json({
        ok: false,
        error: 'Global relay only supports foundation lanes (0-3). Custom lanes must use direct peer connection.',
        'data-testid': 'mesh-relay-error',
      });
      return;
    }
    
    const targetNode = globalNodes.get(message.target);
    if (!targetNode) {
      res.status(404).json({
        ok: false,
        error: 'Target node not found',
        'data-testid': 'mesh-relay-error',
      });
      return;
    }
    
    let senderNodeId: string | null = null;
    for (const [nodeId, manifest] of globalNodes.entries()) {
      if (manifest.wallet.toLowerCase() === wallet?.toLowerCase()) {
        senderNodeId = nodeId;
        break;
      }
    }
    
    if (!senderNodeId) {
      res.status(403).json({
        ok: false,
        error: 'Sender not registered in global network',
        'data-testid': 'mesh-relay-error',
      });
      return;
    }
    
    const sanitizedMessage: RelayMessage = {
      target: message.target,
      lane: lane,
      payload: message.payload,
      timestamp: Date.now(),
      from: senderNodeId,
    };
    
    if (!relayQueue.has(message.target)) {
      relayQueue.set(message.target, []);
    }
    relayQueue.get(message.target)!.push(sanitizedMessage);
    
    if (relayQueue.get(message.target)!.length > 100) {
      relayQueue.get(message.target)!.shift();
    }
    
    totalRelays++;
    
    res.json({
      ok: true,
      relayed: true,
      lane: lane,
      timestamp: Date.now(),
      'data-testid': 'mesh-relay-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Relay failed',
      'data-testid': 'mesh-relay-error',
    });
  }
});

router.get('/messages', (req: Request, res: Response) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    
    let nodeId: string | null = null;
    for (const [id, manifest] of globalNodes.entries()) {
      if (manifest.wallet.toLowerCase() === wallet?.toLowerCase()) {
        nodeId = id;
        manifest.lastSeen = Date.now();
        break;
      }
    }
    
    if (!nodeId) {
      res.json({
        ok: true,
        messages: [],
        'data-testid': 'mesh-messages-response',
      });
      return;
    }
    
    const messages = relayQueue.get(nodeId) || [];
    relayQueue.set(nodeId, []);
    
    res.json({
      ok: true,
      messages,
      'data-testid': 'mesh-messages-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch messages',
      'data-testid': 'mesh-messages-error',
    });
  }
});

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const uptimeMs = Date.now() - startTime;
    
    res.json({
      ok: true,
      nodes: globalNodes.size,
      relays: totalRelays,
      uptime: Math.floor(uptimeMs / 1000),
      foundationLaneVersion: '1.0.0',
      foundationLanes: FOUNDATION_LANES,
      'data-testid': 'mesh-stats-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to fetch stats',
      'data-testid': 'mesh-stats-error',
    });
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    status: 'healthy',
    nodes: globalNodes.size,
    'data-testid': 'mesh-health-response',
  });
});

export default router;
