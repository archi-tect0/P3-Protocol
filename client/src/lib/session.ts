/**
 * Atlas API 2.0 Session Management
 * 
 * Handles session handshake, EventSource subscriptions for manifest/access lanes,
 * binary frame decoding, and sessionId storage for receipt logging.
 */

export interface DeviceCapabilities {
  userAgent: string;
  platform: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  colorDepth: number;
  touchSupported: boolean;
  maxTouchPoints: number;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  webGL?: string;
  hlsSupported: boolean;
  dashSupported: boolean;
  mseSupported: boolean;
  drm?: {
    widevine: boolean;
    fairplay: boolean;
    playready: boolean;
  };
}

export interface SessionHandshakeRequest {
  walletAddress?: string;
  capabilities: DeviceCapabilities;
  resumeToken?: string;
  version?: string;
}

export interface SessionHandshakeResponse {
  sessionId: string;
  expiresAt: number;
  lanes: {
    manifests: string;
    access: string;
    receipts: string;
  };
  features: string[];
  heartbeatInterval: number;
}

export interface LaneFrame {
  type: 'manifest' | 'access' | 'delta' | 'sync' | 'heartbeat' | 'error';
  version: number;
  timestamp: number;
  data?: unknown;
  binary?: Uint8Array;
  checksum?: string;
}

export interface ManifestUpdate {
  itemId: string;
  version: number;
  delta?: Record<string, unknown>;
  full?: Record<string, unknown>;
}

export interface AccessUpdate {
  itemId: string;
  readiness: 'PENDING' | 'READY' | 'DEGRADED';
  access?: {
    mode: string;
    format: string;
    uri?: string;
    embed?: string;
    openWeb?: string;
  };
  fallback?: {
    mode: string;
    format: string;
    uri?: string;
    embed?: string;
    openWeb?: string;
  };
  upgradeEta?: number;
}

type LaneEventHandler = (frame: LaneFrame) => void;
type ConnectionStateHandler = (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

const SESSION_STORAGE_KEY = 'atlas_session';
const HEARTBEAT_MARGIN = 5000;

class AtlasSession {
  private sessionId: string | null = null;
  private expiresAt: number = 0;
  private heartbeatInterval: number = 30000;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lanes: Map<string, EventSource> = new Map();
  private laneHandlers: Map<string, Set<LaneEventHandler>> = new Map();
  private connectionHandlers: Set<ConnectionStateHandler> = new Set();
  private walletAddress: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private baseReconnectDelay: number = 1000;

  getSessionId(): string | null {
    return this.sessionId;
  }

  isActive(): boolean {
    return this.sessionId !== null && Date.now() < this.expiresAt;
  }

  isConnected(): boolean {
    return this.sessionId !== null && 
           Date.now() < this.expiresAt && 
           this.lanes.size > 0;
  }

  async startSession(walletAddress?: string): Promise<SessionHandshakeResponse> {
    const storedWallet = this.getStoredWalletAddress();
    
    // Use stored wallet if none provided (PWA bridge flow)
    const resolvedWallet = walletAddress?.toLowerCase() || storedWallet || null;
    
    // Check if wallet changed - if so, end old session first
    if (storedWallet && walletAddress && storedWallet !== walletAddress.toLowerCase()) {
      console.log('[AtlasSession] Wallet changed from', storedWallet, 'to', walletAddress.toLowerCase(), '- clearing old session');
      await this.endSession();
    }
    
    this.walletAddress = resolvedWallet;
    
    const capabilities = this.gatherCapabilities();
    const resumeToken = this.loadResumeToken(resolvedWallet);

    const request: SessionHandshakeRequest = {
      walletAddress: resolvedWallet || undefined,
      capabilities,
      resumeToken,
      version: '2.0',
    };

    try {
      this.notifyConnectionState('connecting');
      
      const response = await fetch('/api/atlas/session/handshake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(resolvedWallet ? { 'x-wallet-address': resolvedWallet } : {}),
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Handshake failed: ${response.status}`);
      }

      const data: SessionHandshakeResponse = await response.json();
      
      this.sessionId = data.sessionId;
      this.expiresAt = data.expiresAt;
      this.heartbeatInterval = data.heartbeatInterval || 30000;
      this.reconnectAttempts = 0;

      this.saveSession(data);
      this.startHeartbeat();
      this.subscribeToLanes(data.lanes);
      
      this.notifyConnectionState('connected');
      
      return data;
    } catch (error) {
      this.notifyConnectionState('error');
      throw error;
    }
  }

  async endSession(): Promise<void> {
    this.stopHeartbeat();
    this.unsubscribeFromAllLanes();
    
    if (this.sessionId) {
      try {
        await fetch('/api/atlas/session/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-id': this.sessionId,
          },
        });
      } catch {
        // Best effort
      }
    }

    this.sessionId = null;
    this.expiresAt = 0;
    this.clearSavedSession();
    this.notifyConnectionState('disconnected');
  }

  subscribeLane(lane: string, handler: LaneEventHandler): () => void {
    if (!this.laneHandlers.has(lane)) {
      this.laneHandlers.set(lane, new Set());
    }
    this.laneHandlers.get(lane)!.add(handler);

    return () => {
      const handlers = this.laneHandlers.get(lane);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  private gatherCapabilities(): DeviceCapabilities {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const win = typeof window !== 'undefined' ? window : null;
    const screen = typeof window !== 'undefined' ? window.screen : null;
    const connection = nav ? (nav as any).connection : null;

    let webGLRenderer: string | undefined;
    if (win) {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl && 'getExtension' in gl) {
          const ext = (gl as any).getExtension('WEBGL_debug_renderer_info');
          if (ext) {
            webGLRenderer = (gl as any).getParameter(ext.UNMASKED_RENDERER_WEBGL);
          }
        }
      } catch {
        // WebGL not available
      }
    }

    const video = typeof document !== 'undefined' ? document.createElement('video') : null;
    const hlsSupported = video?.canPlayType('application/vnd.apple.mpegurl') !== '' ||
                         typeof (win as any)?.Hls !== 'undefined';
    const dashSupported = typeof (win as any)?.dashjs !== 'undefined';
    const mseSupported = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported?.('video/mp4');

    return {
      userAgent: nav?.userAgent || '',
      platform: nav?.platform || '',
      language: nav?.language || 'en',
      screenWidth: screen?.width || 0,
      screenHeight: screen?.height || 0,
      devicePixelRatio: win?.devicePixelRatio || 1,
      colorDepth: screen?.colorDepth || 24,
      touchSupported: 'ontouchstart' in (win || {}),
      maxTouchPoints: nav?.maxTouchPoints || 0,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      saveData: connection?.saveData,
      hardwareConcurrency: nav?.hardwareConcurrency,
      deviceMemory: (nav as any)?.deviceMemory,
      webGL: webGLRenderer,
      hlsSupported,
      dashSupported,
      mseSupported,
      drm: {
        widevine: false,
        fairplay: false,
        playready: false,
      },
    };
  }

  private subscribeToLanes(lanes: Record<string, string>): void {
    for (const [name, url] of Object.entries(lanes)) {
      this.connectLane(name, url);
    }
  }

  private connectLane(name: string, url: string): void {
    if (this.lanes.has(name)) {
      this.lanes.get(name)!.close();
    }

    const fullUrl = `${url}?sessionId=${this.sessionId}`;
    const es = new EventSource(fullUrl);

    es.onopen = () => {
      console.log(`[AtlasSession] Lane ${name} connected`);
    };

    es.onmessage = (event) => {
      try {
        const frame = this.parseFrame(event.data);
        this.dispatchFrame(name, frame);
      } catch (err) {
        console.error(`[AtlasSession] Failed to parse frame on ${name}:`, err);
      }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        console.warn(`[AtlasSession] Lane ${name} disconnected, reconnecting...`);
        this.scheduleReconnect(name, url);
      }
    };

    this.lanes.set(name, es);
  }

  private scheduleReconnect(name: string, url: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[AtlasSession] Max reconnect attempts reached for ${name}`);
      this.notifyConnectionState('error');
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      if (this.isActive()) {
        this.connectLane(name, url);
      }
    }, delay);
  }

  private unsubscribeFromAllLanes(): void {
    for (const es of this.lanes.values()) {
      es.close();
    }
    this.lanes.clear();
  }

  private parseFrame(data: string): LaneFrame {
    const json = JSON.parse(data);
    
    const frame: LaneFrame = {
      type: json.type,
      version: json.version || 1,
      timestamp: json.timestamp || Date.now(),
      data: json.data,
      checksum: json.checksum,
    };

    if (json.binary) {
      frame.binary = this.decodeBase64(json.binary);
    }

    return frame;
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private dispatchFrame(lane: string, frame: LaneFrame): void {
    const handlers = this.laneHandlers.get(lane);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(frame);
        } catch (err) {
          console.error(`[AtlasSession] Handler error on ${lane}:`, err);
        }
      }
    }

    const allHandlers = this.laneHandlers.get('*');
    if (allHandlers) {
      for (const handler of allHandlers) {
        try {
          handler(frame);
        } catch (err) {
          console.error(`[AtlasSession] Handler error on *:`, err);
        }
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    const interval = this.heartbeatInterval - HEARTBEAT_MARGIN;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.sessionId) return;

    try {
      const response = await fetch('/api/atlas/session/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': this.sessionId,
        },
        body: JSON.stringify({ timestamp: Date.now() }),
      });

      if (!response.ok && response.status === 401) {
        console.warn('[AtlasSession] Session expired, ending...');
        await this.endSession();
      }
    } catch {
      console.warn('[AtlasSession] Heartbeat failed');
    }
  }

  private notifyConnectionState(state: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(state);
      } catch (err) {
        console.error('[AtlasSession] Connection state handler error:', err);
      }
    }
  }

  private saveSession(data: SessionHandshakeResponse): void {
    try {
      const stored = {
        sessionId: data.sessionId,
        expiresAt: data.expiresAt,
        lanes: data.lanes,
        walletAddress: this.walletAddress,
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage not available
    }
  }

  private getStoredWalletAddress(): string | null {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data.walletAddress?.toLowerCase() || null;
      }
    } catch {
      // Storage not available or invalid
    }
    return null;
  }

  private loadResumeToken(currentWallet: string | null): string | undefined {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const storedWallet = data.walletAddress?.toLowerCase() || null;
        
        // Only resume if wallet matches (case-insensitive) and session not expired
        if (data.expiresAt > Date.now()) {
          if (currentWallet === storedWallet || (!currentWallet && !storedWallet)) {
            return data.sessionId;
          } else {
            // Wallet mismatch - clear stale session
            console.log('[AtlasSession] Stored session wallet mismatch, clearing');
            this.clearSavedSession();
          }
        }
      }
    } catch {
      // Storage not available or invalid
    }
    return undefined;
  }

  private clearSavedSession(): void {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Storage not available
    }
  }
}

export const atlasSession = new AtlasSession();

export function startSession(walletAddress?: string): Promise<SessionHandshakeResponse> {
  return atlasSession.startSession(walletAddress);
}

export function endSession(): Promise<void> {
  return atlasSession.endSession();
}

export function getSessionId(): string | null {
  return atlasSession.getSessionId();
}

export function isSessionActive(): boolean {
  return atlasSession.isActive();
}

export function subscribeLane(lane: string, handler: LaneEventHandler): () => void {
  return atlasSession.subscribeLane(lane, handler);
}

export function onConnectionStateChange(handler: ConnectionStateHandler): () => void {
  return atlasSession.onConnectionStateChange(handler);
}

export function subscribeManifests(
  handler: (update: ManifestUpdate) => void
): () => void {
  return atlasSession.subscribeLane('manifests', (frame) => {
    if (frame.type === 'manifest' || frame.type === 'delta') {
      handler(frame.data as ManifestUpdate);
    }
  });
}

export function subscribeAccess(
  handler: (update: AccessUpdate) => void
): () => void {
  return atlasSession.subscribeLane('access', (frame) => {
    if (frame.type === 'access') {
      handler(frame.data as AccessUpdate);
    }
  });
}

export interface SessionData {
  sessionId: string | null;
  isActive: boolean;
  expiresAt: number;
  lanes: {
    manifests: string;
    access: string;
    receipts: string;
  } | null;
  features: string[];
  walletAddress: string | null;
  capabilities: DeviceCapabilities | null;
}

let cachedSessionData: SessionData | null = null;
let cachedCapabilities: DeviceCapabilities | null = null;
let cachedLanes: SessionData['lanes'] | null = null;
let cachedFeatures: string[] = [];

export async function initSession(
  walletAddress?: string,
  customCapabilities?: Partial<DeviceCapabilities>
): Promise<SessionData> {
  const response = await atlasSession.startSession(walletAddress);
  
  cachedCapabilities = detectDeviceCapabilities();
  if (customCapabilities) {
    cachedCapabilities = { ...cachedCapabilities, ...customCapabilities };
  }
  
  cachedLanes = response.lanes;
  cachedFeatures = response.features;
  
  cachedSessionData = {
    sessionId: response.sessionId,
    isActive: true,
    expiresAt: response.expiresAt,
    lanes: response.lanes,
    features: response.features,
    walletAddress: walletAddress || null,
    capabilities: cachedCapabilities,
  };
  
  return cachedSessionData;
}

export function getSession(): SessionData {
  if (cachedSessionData && atlasSession.isActive()) {
    return cachedSessionData;
  }
  
  return {
    sessionId: atlasSession.getSessionId(),
    isActive: atlasSession.isActive(),
    expiresAt: 0,
    lanes: cachedLanes,
    features: cachedFeatures,
    walletAddress: null,
    capabilities: cachedCapabilities,
  };
}

export function subscribeToLane(
  lane: 'manifests' | 'access' | 'receipts' | '*',
  callback: (frame: LaneFrame) => void
): () => void {
  return atlasSession.subscribeLane(lane, callback);
}

export function detectDeviceCapabilities(): DeviceCapabilities {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const win = typeof window !== 'undefined' ? window : null;
  const screen = typeof window !== 'undefined' ? window.screen : null;
  const connection = nav ? (nav as any).connection : null;

  let webGLRenderer: string | undefined;
  if (win) {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl && 'getExtension' in gl) {
        const ext = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          webGLRenderer = (gl as any).getParameter(ext.UNMASKED_RENDERER_WEBGL);
        }
      }
    } catch {
      // WebGL not available
    }
  }

  const video = typeof document !== 'undefined' ? document.createElement('video') : null;
  const hlsSupported = video?.canPlayType('application/vnd.apple.mpegurl') !== '' ||
                       typeof (win as any)?.Hls !== 'undefined';
  const dashSupported = typeof (win as any)?.dashjs !== 'undefined';
  const mseSupported = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported?.('video/mp4');

  detectEpubSupport();
  
  let drmCapabilities = {
    widevine: false,
    fairplay: false,
    playready: false,
  };
  
  if (typeof navigator !== 'undefined' && 'requestMediaKeySystemAccess' in navigator) {
    detectDrmSupport().then(drm => {
      drmCapabilities = drm;
    }).catch(() => {});
  }

  return {
    userAgent: nav?.userAgent || '',
    platform: nav?.platform || '',
    language: nav?.language || 'en',
    screenWidth: screen?.width || 0,
    screenHeight: screen?.height || 0,
    devicePixelRatio: win?.devicePixelRatio || 1,
    colorDepth: screen?.colorDepth || 24,
    touchSupported: 'ontouchstart' in (win || {}),
    maxTouchPoints: nav?.maxTouchPoints || 0,
    connectionType: connection?.type,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    saveData: connection?.saveData,
    hardwareConcurrency: nav?.hardwareConcurrency,
    deviceMemory: (nav as any)?.deviceMemory,
    webGL: webGLRenderer,
    hlsSupported,
    dashSupported,
    mseSupported,
    drm: drmCapabilities,
  };
}

function detectEpubSupport(): boolean {
  if (typeof document === 'undefined') return false;
  
  const xhr = typeof XMLHttpRequest !== 'undefined';
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasIndexedDB = 'indexedDB' in window;
  
  return xhr && hasServiceWorker && hasIndexedDB;
}

async function detectDrmSupport(): Promise<{
  widevine: boolean;
  fairplay: boolean;
  playready: boolean;
}> {
  const result = {
    widevine: false,
    fairplay: false,
    playready: false,
  };
  
  if (typeof navigator === 'undefined' || !('requestMediaKeySystemAccess' in navigator)) {
    return result;
  }
  
  const configs = [{
    initDataTypes: ['cenc'],
    videoCapabilities: [{
      contentType: 'video/mp4; codecs="avc1.42E01E"',
    }],
  }];
  
  try {
    await navigator.requestMediaKeySystemAccess('com.widevine.alpha', configs);
    result.widevine = true;
  } catch {}
  
  try {
    await navigator.requestMediaKeySystemAccess('com.apple.fps.1_0', configs);
    result.fairplay = true;
  } catch {}
  
  try {
    await navigator.requestMediaKeySystemAccess('com.microsoft.playready', configs);
    result.playready = true;
  } catch {}
  
  return result;
}

export function decodeBinaryFrame(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function parseBinaryAccessFrame(binary: Uint8Array): AccessUpdate | null {
  try {
    const decoder = new TextDecoder();
    const headerEnd = binary.indexOf(0);
    
    if (headerEnd === -1) {
      const json = decoder.decode(binary);
      return JSON.parse(json);
    }
    
    const headerBytes = binary.slice(0, headerEnd);
    const header = decoder.decode(headerBytes);
    const parts = header.split(':');
    
    if (parts.length < 3) {
      return null;
    }
    
    const [itemId, readiness, accessMode] = parts;
    const payloadBytes = binary.slice(headerEnd + 1);
    
    let access: AccessUpdate['access'] | undefined;
    let fallback: AccessUpdate['fallback'] | undefined;
    
    if (payloadBytes.length > 0) {
      const payloadJson = decoder.decode(payloadBytes);
      const payload = JSON.parse(payloadJson);
      access = payload.access;
      fallback = payload.fallback;
    }
    
    return {
      itemId,
      readiness: readiness as 'PENDING' | 'READY' | 'DEGRADED',
      access: access || (accessMode ? { mode: accessMode, format: 'unknown' } : undefined),
      fallback,
    };
  } catch (err) {
    console.error('[Session] Failed to parse binary access frame:', err);
    return null;
  }
}

export function getLaneUrls(): SessionData['lanes'] | null {
  return cachedLanes;
}

export interface SessionLane {
  name: string;
  url: string;
  type: 'manifests' | 'access' | 'receipts' | 'events';
  connected: boolean;
}

export function getSessionLanes(): SessionLane[] {
  if (!cachedLanes) return [];
  
  return Object.entries(cachedLanes).map(([name, url]) => ({
    name,
    url,
    type: name as SessionLane['type'],
    connected: atlasSession.isConnected(),
  }));
}

export function getSessionFeatures(): string[] {
  return cachedFeatures;
}

export function hasFeature(feature: string): boolean {
  return cachedFeatures.includes(feature);
}

export function getCapabilities(): DeviceCapabilities | null {
  return cachedCapabilities;
}

export interface NegotiatedCapabilities {
  video: {
    hls: boolean;
    dash: boolean;
    mp4: boolean;
    preferredFormat: 'hls' | 'dash' | 'mp4';
  };
  audio: {
    mp3: boolean;
    aac: boolean;
    ogg: boolean;
    flac: boolean;
  };
  documents: {
    epub: boolean;
    pdf: boolean;
    docx: boolean;
  };
  drm: {
    widevine: boolean;
    fairplay: boolean;
    playready: boolean;
    preferredDrm: 'widevine' | 'fairplay' | 'playready' | 'none';
  };
  network: {
    effectiveType: string;
    saveData: boolean;
    recommendedQuality: 'auto' | '4k' | '1080p' | '720p' | '480p';
  };
}

let negotiatedCapabilities: NegotiatedCapabilities | null = null;

export async function negotiateCapabilities(): Promise<NegotiatedCapabilities> {
  const deviceCaps = cachedCapabilities || detectDeviceCapabilities();
  
  const video = document.createElement('video');
  const audio = document.createElement('audio');
  
  const hlsSupported = deviceCaps.hlsSupported || 
    video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
    (typeof (window as any).Hls !== 'undefined' && (window as any).Hls.isSupported());
  
  const dashSupported = deviceCaps.dashSupported || 
    (typeof (window as any).dashjs !== 'undefined') ||
    (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'));
  
  const mp4Supported = video.canPlayType('video/mp4') !== '';
  
  let preferredFormat: 'hls' | 'dash' | 'mp4' = 'mp4';
  if (hlsSupported) {
    preferredFormat = 'hls';
  } else if (dashSupported) {
    preferredFormat = 'dash';
  }
  
  const mp3Supported = audio.canPlayType('audio/mpeg') !== '';
  const aacSupported = audio.canPlayType('audio/aac') !== '' || audio.canPlayType('audio/mp4') !== '';
  const oggSupported = audio.canPlayType('audio/ogg') !== '';
  const flacSupported = audio.canPlayType('audio/flac') !== '';
  
  const epubSupported = detectEpubSupportForNegotiation();
  const pdfSupported = detectPdfSupport();
  const docxSupported = detectDocxSupport();
  
  let drmCaps = deviceCaps.drm || { widevine: false, fairplay: false, playready: false };
  
  if (!drmCaps.widevine && !drmCaps.fairplay && !drmCaps.playready) {
    drmCaps = await detectDrmSupportAsync();
  }
  
  let preferredDrm: 'widevine' | 'fairplay' | 'playready' | 'none' = 'none';
  if (drmCaps.widevine) preferredDrm = 'widevine';
  else if (drmCaps.fairplay) preferredDrm = 'fairplay';
  else if (drmCaps.playready) preferredDrm = 'playready';
  
  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType || '4g';
  const saveData = connection?.saveData || false;
  
  let recommendedQuality: 'auto' | '4k' | '1080p' | '720p' | '480p' = 'auto';
  if (saveData) {
    recommendedQuality = '480p';
  } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    recommendedQuality = '480p';
  } else if (effectiveType === '3g') {
    recommendedQuality = '720p';
  } else if (deviceCaps.screenWidth >= 3840) {
    recommendedQuality = '4k';
  } else if (deviceCaps.screenWidth >= 1920) {
    recommendedQuality = '1080p';
  }
  
  negotiatedCapabilities = {
    video: {
      hls: hlsSupported,
      dash: dashSupported,
      mp4: mp4Supported,
      preferredFormat,
    },
    audio: {
      mp3: mp3Supported,
      aac: aacSupported,
      ogg: oggSupported,
      flac: flacSupported,
    },
    documents: {
      epub: epubSupported,
      pdf: pdfSupported,
      docx: docxSupported,
    },
    drm: {
      ...drmCaps,
      preferredDrm,
    },
    network: {
      effectiveType,
      saveData,
      recommendedQuality,
    },
  };
  
  return negotiatedCapabilities;
}

function detectEpubSupportForNegotiation(): boolean {
  if (typeof document === 'undefined') return false;
  
  const hasXhr = typeof XMLHttpRequest !== 'undefined';
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasIndexedDB = 'indexedDB' in window;
  
  return hasXhr && hasServiceWorker && hasIndexedDB;
}

function detectPdfSupport(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const hasPdfPlugin = Array.from(navigator.plugins || []).some(
    plugin => plugin.name.toLowerCase().includes('pdf')
  );
  
  const hasEmbed = typeof HTMLEmbedElement !== 'undefined';
  const hasIframe = typeof HTMLIFrameElement !== 'undefined';
  
  return hasPdfPlugin || hasEmbed || hasIframe;
}

function detectDocxSupport(): boolean {
  return typeof (window as any).mammoth !== 'undefined' ||
         typeof (window as any).docx !== 'undefined';
}

async function detectDrmSupportAsync(): Promise<{
  widevine: boolean;
  fairplay: boolean;
  playready: boolean;
}> {
  const result = {
    widevine: false,
    fairplay: false,
    playready: false,
  };
  
  if (typeof navigator === 'undefined' || !('requestMediaKeySystemAccess' in navigator)) {
    return result;
  }
  
  const configs = [{
    initDataTypes: ['cenc'],
    videoCapabilities: [{
      contentType: 'video/mp4; codecs="avc1.42E01E"',
    }],
  }];
  
  try {
    await navigator.requestMediaKeySystemAccess('com.widevine.alpha', configs);
    result.widevine = true;
  } catch {}
  
  try {
    await navigator.requestMediaKeySystemAccess('com.apple.fps.1_0', configs);
    result.fairplay = true;
  } catch {}
  
  try {
    await navigator.requestMediaKeySystemAccess('com.microsoft.playready', configs);
    result.playready = true;
  } catch {}
  
  return result;
}

export function getNegotiatedCapabilities(): NegotiatedCapabilities | null {
  return negotiatedCapabilities;
}

export function canPlayFormat(format: string): boolean {
  if (!negotiatedCapabilities) return true;
  
  switch (format.toLowerCase()) {
    case 'hls':
      return negotiatedCapabilities.video.hls;
    case 'dash':
      return negotiatedCapabilities.video.dash;
    case 'mp4':
      return negotiatedCapabilities.video.mp4;
    case 'mp3':
      return negotiatedCapabilities.audio.mp3;
    case 'aac':
      return negotiatedCapabilities.audio.aac;
    case 'ogg':
      return negotiatedCapabilities.audio.ogg;
    case 'flac':
      return negotiatedCapabilities.audio.flac;
    case 'epub':
      return negotiatedCapabilities.documents.epub;
    case 'pdf':
      return negotiatedCapabilities.documents.pdf;
    case 'docx':
      return negotiatedCapabilities.documents.docx;
    default:
      return true;
  }
}

export function getPreferredVideoFormat(): 'hls' | 'dash' | 'mp4' {
  return negotiatedCapabilities?.video.preferredFormat || 'mp4';
}

export function getPreferredDrm(): 'widevine' | 'fairplay' | 'playready' | 'none' {
  return negotiatedCapabilities?.drm.preferredDrm || 'none';
}

export function getRecommendedQuality(): 'auto' | '4k' | '1080p' | '720p' | '480p' {
  return negotiatedCapabilities?.network.recommendedQuality || 'auto';
}
