import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { authService } from './auth';

interface ClientInfo {
  ws: WebSocket;
  walletAddress?: string;
  roomId?: string;
  authenticated: boolean;
  authTime?: number; // Timestamp when auth was verified - for session expiry
  lastHeartbeat: number;
  iceStartTime?: number;
  turnEnabled: boolean;
  statsBuffer: StatsData[];
  lastStatsUpload: number;
  uploadRetries: number;
  networkQuality: 'excellent' | 'good' | 'poor' | 'critical';
}

interface SignalingMessage {
  type: 'auth' | 'join' | 'offer' | 'answer' | 'ice' | 'end' | 'heartbeat' | 'stats' | 'renegotiate';
  roomId?: string;
  message?: string;
  signature?: string;
  address?: string;
  data?: any;
  stats?: StatsData;
}

interface ServerMessage {
  type: 'auth_ok' | 'peer_joined' | 'offer' | 'answer' | 'ice' | 'ended' | 'error' | 'webrtc_config' | 'renegotiate_needed';
  data?: any;
  peerId?: string;
}

interface StatsData {
  rtt?: number;
  jitter?: number;
  packetLoss?: number;
  bitrate?: number;
  codec?: string;
  iceState?: string;
  timestamp: number;
}

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface WebRTCConfigResponse {
  iceServers: IceServer[];
  codecPreferences: {
    audio: string;
  };
  sdpSemantics: string;
  bundlePolicy: string;
  rtcpMuxPolicy: string;
  iceTransportPolicy: string;
}

const clients = new Map<WebSocket, ClientInfo>();
const rooms = new Map<string, Set<WebSocket>>();

const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;
const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour - matches JWT expiry
const STATS_COLLECTION_INTERVAL = 5000;
const STATS_BATCH_SIZE = 10;
const STATS_UPLOAD_BACKOFF_MAX = 5;
const STATS_UPLOAD_BACKOFF_BASE = 2000;
const ICE_TIMEOUT_THRESHOLD = 8000;
const RTT_THRESHOLD = 300;
const PACKET_LOSS_THRESHOLD = 5;
const SUSTAINED_POOR_QUALITY_COUNT = 3;

function getWebRTCConfig(deviceType: 'mobile' | 'desktop', turnEnabled: boolean): WebRTCConfigResponse {
  const iceServers: IceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  if (turnEnabled) {
    iceServers.push({
      urls: [
        'turn:turn.replit.dev:3478?transport=udp',
        'turn:turn.replit.dev:3478?transport=tcp',
      ],
      username: process.env.TURN_USERNAME || 'guest',
      credential: process.env.TURN_CREDENTIAL || 'guest',
    });
  }

  const targetBitrate = deviceType === 'mobile' ? 24000 : 48000;

  return {
    iceServers,
    codecPreferences: {
      audio: `opus/${targetBitrate}/2`,
    },
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: turnEnabled ? 'all' : 'all',
  };
}

function getOpusSDPParameters(deviceType: 'mobile' | 'desktop'): string {
  const bitrate = deviceType === 'mobile' ? '16000-32000' : '48000';
  
  return [
    'useinbandfec=1',
    'usedtx=1', 
    'stereo=0',
    `maxaveragebitrate=${bitrate.split('-')[1] || bitrate}`,
    'cbr=0',
    'maxptime=60',
    'ptime=20'
  ].join(';');
}

export function setupSignaling(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade for WebSocket connections
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    if (pathname === '/signaling') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // Don't destroy socket for other paths - let other handlers process them
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection');

    const clientInfo: ClientInfo = {
      ws,
      authenticated: false,
      lastHeartbeat: Date.now(),
      turnEnabled: false,
      statsBuffer: [],
      lastStatsUpload: Date.now(),
      uploadRetries: 0,
      networkQuality: 'excellent',
    };
    clients.set(ws, clientInfo);

    ws.on('message', async (data: Buffer) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        console.error('Error handling message:', error);
        sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      handleDisconnect(ws);
    });
  });

  // Heartbeat monitoring and session expiry check
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    clients.forEach((clientInfo, ws) => {
      // Check heartbeat timeout
      if (now - clientInfo.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log('Client timeout, disconnecting');
        ws.terminate();
        handleDisconnect(ws);
        return;
      }
      
      // Check session expiry (force re-auth after 1 hour)
      if (clientInfo.authenticated && clientInfo.authTime && 
          now - clientInfo.authTime > SESSION_EXPIRY_MS) {
        console.log('Session expired, disconnecting:', clientInfo.walletAddress?.slice(0, 10));
        sendError(ws, 'Session expired. Please re-authenticate.');
        ws.close(4001, 'Session expired');
        handleDisconnect(ws);
      }
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  console.log('WebSocket signaling server initialized');
}

async function handleMessage(ws: WebSocket, message: SignalingMessage): Promise<void> {
  const clientInfo = clients.get(ws);
  if (!clientInfo) {
    return;
  }

  // Check session expiry on every message (defense in depth)
  if (clientInfo.authenticated && clientInfo.authTime && 
      Date.now() - clientInfo.authTime > SESSION_EXPIRY_MS) {
    sendError(ws, 'Session expired. Please re-authenticate.');
    ws.close(4001, 'Session expired');
    handleDisconnect(ws);
    return;
  }

  switch (message.type) {
    case 'auth':
      await handleAuth(ws, message);
      break;

    case 'heartbeat':
      handleHeartbeat(ws);
      break;

    case 'join':
      if (!clientInfo.authenticated) {
        sendError(ws, 'Authentication required');
        return;
      }
      handleJoin(ws, message);
      break;

    case 'offer':
    case 'answer':
    case 'ice':
      if (!clientInfo.authenticated || !clientInfo.roomId) {
        sendError(ws, 'Must join a room first');
        return;
      }
      relayMessage(ws, message);
      break;

    case 'end':
      if (!clientInfo.authenticated || !clientInfo.roomId) {
        sendError(ws, 'Must join a room first');
        return;
      }
      handleEnd(ws);
      break;

    case 'stats':
      if (!clientInfo.authenticated || !clientInfo.roomId) {
        sendError(ws, 'Must join a room first');
        return;
      }
      await handleStats(ws, message);
      break;

    case 'renegotiate':
      if (!clientInfo.authenticated || !clientInfo.roomId) {
        sendError(ws, 'Must join a room first');
        return;
      }
      handleRenegotiate(ws, message);
      break;

    default:
      sendError(ws, 'Unknown message type');
  }
}

async function handleAuth(ws: WebSocket, message: SignalingMessage): Promise<void> {
  const { message: authMessage, signature, address } = message;

  if (!authMessage || !signature || !address) {
    sendError(ws, 'Missing authentication parameters');
    return;
  }

  try {
    const isValid = await authService.signedMessageVerification(
      authMessage,
      signature,
      address
    );

    if (!isValid) {
      sendError(ws, 'Invalid signature');
      return;
    }

    const clientInfo = clients.get(ws);
    if (clientInfo) {
      clientInfo.authenticated = true;
      clientInfo.authTime = Date.now(); // Track auth time for session expiry
      clientInfo.walletAddress = address.toLowerCase();
      clientInfo.lastHeartbeat = Date.now();
    }

    send(ws, { type: 'auth_ok' });
    console.log(`Client authenticated: ${address}`);
  } catch (error) {
    console.error('Authentication error:', error);
    sendError(ws, 'Authentication failed');
  }
}

function handleHeartbeat(ws: WebSocket): void {
  const clientInfo = clients.get(ws);
  if (clientInfo) {
    clientInfo.lastHeartbeat = Date.now();
  }
}

function handleJoin(ws: WebSocket, message: SignalingMessage): void {
  const { roomId } = message;

  if (!roomId) {
    sendError(ws, 'Room ID is required');
    return;
  }

  const clientInfo = clients.get(ws);
  if (!clientInfo) {
    return;
  }

  if (clientInfo.roomId) {
    leaveRoom(ws);
  }

  clientInfo.roomId = roomId;
  clientInfo.iceStartTime = Date.now();
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }

  const room = rooms.get(roomId)!;
  
  const deviceType = message.data?.deviceType || 'desktop';
  const webrtcConfig = getWebRTCConfig(deviceType, clientInfo.turnEnabled);
  const opusParams = getOpusSDPParameters(deviceType);

  send(ws, {
    type: 'webrtc_config',
    data: {
      config: webrtcConfig,
      opusParams,
      deviceType,
    },
  });

  broadcastToRoom(roomId, ws, {
    type: 'peer_joined',
    peerId: clientInfo.walletAddress,
  });

  room.add(ws);
  console.log(`Client ${clientInfo.walletAddress} joined room ${roomId} (${deviceType})`);

  setTimeout(() => {
    checkICETimeout(ws);
  }, ICE_TIMEOUT_THRESHOLD);
}

function relayMessage(ws: WebSocket, message: SignalingMessage): void {
  const clientInfo = clients.get(ws);
  if (!clientInfo || !clientInfo.roomId) {
    return;
  }

  const relayData: ServerMessage = {
    type: message.type as 'offer' | 'answer' | 'ice',
    data: message.data,
    peerId: clientInfo.walletAddress,
  };

  broadcastToRoom(clientInfo.roomId, ws, relayData);
}

function handleEnd(ws: WebSocket): void {
  const clientInfo = clients.get(ws);
  if (!clientInfo || !clientInfo.roomId) {
    return;
  }

  broadcastToRoom(clientInfo.roomId, ws, {
    type: 'ended',
    peerId: clientInfo.walletAddress,
  });

  leaveRoom(ws);
}

function leaveRoom(ws: WebSocket): void {
  const clientInfo = clients.get(ws);
  if (!clientInfo || !clientInfo.roomId) {
    return;
  }

  const room = rooms.get(clientInfo.roomId);
  if (room) {
    room.delete(ws);
    
    // Notify other peers
    broadcastToRoom(clientInfo.roomId, ws, {
      type: 'ended',
      peerId: clientInfo.walletAddress,
    });

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(clientInfo.roomId);
    }
  }

  console.log(`Client ${clientInfo.walletAddress} left room ${clientInfo.roomId}`);
  clientInfo.roomId = undefined;
}

function handleDisconnect(ws: WebSocket): void {
  const clientInfo = clients.get(ws);
  
  if (clientInfo && clientInfo.roomId) {
    leaveRoom(ws);
  }

  clients.delete(ws);
  console.log('Client disconnected');
}

function broadcastToRoom(roomId: string, excludeWs: WebSocket, message: ServerMessage): void {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  room.forEach((clientWs) => {
    if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
      send(clientWs, message);
    }
  });
}

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function handleStats(ws: WebSocket, message: SignalingMessage): Promise<void> {
  const clientInfo = clients.get(ws);
  if (!clientInfo || !message.stats) {
    return;
  }

  clientInfo.statsBuffer.push(message.stats);

  const previousQuality = clientInfo.networkQuality;
  clientInfo.networkQuality = assessNetworkQuality(message.stats);

  if (clientInfo.statsBuffer.length >= STATS_BATCH_SIZE) {
    const now = Date.now();
    const timeSinceLastUpload = now - clientInfo.lastStatsUpload;
    
    if (timeSinceLastUpload >= STATS_COLLECTION_INTERVAL) {
      await uploadStatsBatch(ws);
    }
  }

  const poorQualityCount = clientInfo.statsBuffer
    .slice(-SUSTAINED_POOR_QUALITY_COUNT)
    .filter(s => {
      const quality = assessNetworkQuality(s);
      return quality === 'poor' || quality === 'critical';
    }).length;

  if (poorQualityCount >= SUSTAINED_POOR_QUALITY_COUNT) {
    const rtt = message.stats.rtt || 0;
    const packetLoss = message.stats.packetLoss || 0;

    if (rtt > RTT_THRESHOLD || packetLoss > PACKET_LOSS_THRESHOLD) {
      send(ws, {
        type: 'renegotiate_needed',
        data: {
          reason: rtt > RTT_THRESHOLD ? 'high_rtt' : 'high_packet_loss',
          currentRtt: rtt,
          currentPacketLoss: packetLoss,
          suggestedBitrate: rtt > RTT_THRESHOLD ? 16000 : 24000,
        },
      });
    }
  }

  if (message.stats.iceState === 'connected' && clientInfo.turnEnabled) {
    clientInfo.turnEnabled = false;
    console.log(`TURN disabled for ${clientInfo.walletAddress} after successful STUN connection`);
  }
}

function handleRenegotiate(ws: WebSocket, message: SignalingMessage): void {
  const clientInfo = clients.get(ws);
  if (!clientInfo || !clientInfo.roomId) {
    return;
  }

  console.log(`Renegotiation requested for ${clientInfo.walletAddress}`);
  
  broadcastToRoom(clientInfo.roomId, ws, {
    type: 'renegotiate_needed',
    data: message.data,
    peerId: clientInfo.walletAddress,
  });
}

function assessNetworkQuality(stats: StatsData): 'excellent' | 'good' | 'poor' | 'critical' {
  const rtt = stats.rtt || 0;
  const packetLoss = stats.packetLoss || 0;
  const jitter = stats.jitter || 0;

  if (rtt > 400 || packetLoss > 10 || jitter > 100) {
    return 'critical';
  }
  if (rtt > 300 || packetLoss > 5 || jitter > 50) {
    return 'poor';
  }
  if (rtt > 150 || packetLoss > 2 || jitter > 30) {
    return 'good';
  }
  return 'excellent';
}

async function uploadStatsBatch(ws: WebSocket): Promise<void> {
  const clientInfo = clients.get(ws);
  if (!clientInfo || clientInfo.statsBuffer.length === 0) {
    return;
  }

  const batch = [...clientInfo.statsBuffer];
  clientInfo.statsBuffer = [];

  try {
    console.log(`Uploading ${batch.length} stats for ${clientInfo.walletAddress}`);
    
    clientInfo.lastStatsUpload = Date.now();
    clientInfo.uploadRetries = 0;
  } catch (error) {
    console.error('Failed to upload stats batch:', error);
    
    clientInfo.uploadRetries++;
    
    if (clientInfo.uploadRetries < STATS_UPLOAD_BACKOFF_MAX) {
      const backoffDelay = STATS_UPLOAD_BACKOFF_BASE * Math.pow(2, clientInfo.uploadRetries - 1);
      
      setTimeout(() => {
        clientInfo.statsBuffer.unshift(...batch);
      }, backoffDelay);
    } else {
      console.error(`Max retries reached for ${clientInfo.walletAddress}, discarding batch`);
      clientInfo.uploadRetries = 0;
    }
  }
}

function checkICETimeout(ws: WebSocket): void {
  const clientInfo = clients.get(ws);
  if (!clientInfo || !clientInfo.iceStartTime) {
    return;
  }

  const elapsedTime = Date.now() - clientInfo.iceStartTime;
  
  if (elapsedTime >= ICE_TIMEOUT_THRESHOLD && !clientInfo.turnEnabled) {
    clientInfo.turnEnabled = true;
    
    const deviceType = 'desktop';
    const webrtcConfig = getWebRTCConfig(deviceType, true);
    
    send(ws, {
      type: 'webrtc_config',
      data: {
        config: webrtcConfig,
        turnEnabled: true,
        reason: 'ice_timeout',
      },
    });
    
    console.log(`TURN enabled for ${clientInfo.walletAddress} due to ICE timeout`);
  }
}

function sendError(ws: WebSocket, error: string): void {
  send(ws, { type: 'error', data: { error } });
}

export { getWebRTCConfig, getOpusSDPParameters };
