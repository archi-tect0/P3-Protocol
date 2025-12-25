/**
 * Access Renderer - Client-side access manifest resolution and rendering
 * 
 * This module provides utilities to:
 * 1. Fetch access manifests for catalog items
 * 2. Dispatch to appropriate player/reader/launcher based on access type
 * 3. Log access receipts for analytics and audit
 * 4. Handle graded readiness states (PENDING, READY, DEGRADED)
 * 5. Decode binary access frames from SSE lanes
 * 
 * Supports ALL Atlas OS verticals:
 * - Live TV (HLS/DASH streams)
 * - Videos (HLS/DASH/embedded)
 * - Ebooks (EPUB/PDF readers, OpenWeb)
 * - Games (Embedded/OpenWeb)
 * - Products (Browser checkout)
 * - Documents (PDF/Office/Google Drive)
 * - Governance (Snapshot/Tally voting)
 * - Galleries (Images/Photo collections)
 * - Audio/Podcasts (Spotify/SoundCloud/RSS)
 */

import { apiRequest } from './queryClient';
import {
  subscribeAccess,
  decodeBinaryFrame,
  parseBinaryAccessFrame,
  type AccessUpdate,
  getSessionLanes,
} from './session';
import {
  deserializeAccessFrame,
  parseCompactFrame,
  accessFrameParser,
  type AccessFrame,
  type AccessPayload,
  isFrameExpired,
} from './wire/accessFrame';
import type { AccessManifest, AccessMode, AccessFormat, AccessAction as SchemaAccessAction } from '@shared/schema';

// All item types across the mesh OS
export type ItemType = 'channel' | 'video' | 'ebook' | 'game' | 'product' | 'app' | 'audio' | 'document' | 'governance' | 'gallery';

// Use schema-defined action types
export type AccessAction = SchemaAccessAction;

export type { AccessManifest, AccessMode, AccessFormat };

// Graded readiness states for access resolution
export type ReadinessState = 'PENDING' | 'READY' | 'DEGRADED';

export interface AccessResolution {
  itemId: string;
  itemType: ItemType;
  title: string;
  access: AccessManifest;
}

// Extended resolution with graded readiness
export interface GradedAccessResolution extends AccessResolution {
  readiness: ReadinessState;
  fallback?: AccessManifest;
  upgradeEta?: number;
}

export interface AccessReceipt {
  itemId?: string;
  itemType: ItemType;
  source?: string;
  providerId?: string;
  action: AccessAction;
  accessMode?: AccessMode;
  accessFormat?: AccessFormat;
  accessUri?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

const isExternalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return !parsed.hostname.includes('p3protocol') && 
           !parsed.hostname.includes('localhost') &&
           !parsed.hostname.includes('127.0.0.1');
  } catch {
    return false;
  }
};

export async function fetchAccessManifest(itemId: string): Promise<AccessResolution | null> {
  try {
    const response = await fetch(`/api/atlas-one/access/${itemId}`);
    if (!response.ok) {
      console.warn(`[AccessRenderer] Failed to fetch access for ${itemId}:`, response.status);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error('[AccessRenderer] Error fetching access manifest:', err);
    return null;
  }
}

export async function logAccessReceipt(
  receipt: AccessReceipt,
  walletAddress: string
): Promise<{ ok: boolean; receiptId?: string }> {
  try {
    const response = await apiRequest('/api/atlas-one/access/receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': walletAddress,
      },
      body: JSON.stringify(receipt),
    });
    return response.json();
  } catch (err) {
    console.error('[AccessRenderer] Error logging access receipt:', err);
    return { ok: false };
  }
}

export interface RenderAccessOptions {
  containerRef?: HTMLElement;
  walletAddress?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  onProgress?: (position: number, duration: number) => void;
  onReadinessChange?: (state: ReadinessState) => void;
  onUpgradeAvailable?: (newAccess: AccessManifest) => void;
  autoplay?: boolean;
  startPosition?: number;
  showLoadingState?: boolean;
  autoUpgrade?: boolean;
}

export interface RenderResult {
  type: 'player' | 'reader' | 'embed' | 'redirect' | 'error' | 'pending';
  element?: HTMLElement;
  url?: string;
  cleanup?: () => void;
  readiness?: ReadinessState;
  upgrade?: () => void;
}

// Readiness state manager for handling graded access
interface ReadinessManager {
  currentState: ReadinessState;
  currentResult: RenderResult | null;
  pendingUpgrade: AccessManifest | null;
  unsubscribe: (() => void) | null;
}

const readinessManagers = new Map<string, ReadinessManager>();

function getOrCreateManager(itemId: string): ReadinessManager {
  if (!readinessManagers.has(itemId)) {
    readinessManagers.set(itemId, {
      currentState: 'PENDING',
      currentResult: null,
      pendingUpgrade: null,
      unsubscribe: null,
    });
  }
  return readinessManagers.get(itemId)!;
}

function cleanupManager(itemId: string): void {
  const manager = readinessManagers.get(itemId);
  if (manager) {
    if (manager.unsubscribe) {
      manager.unsubscribe();
    }
    if (manager.currentResult?.cleanup) {
      manager.currentResult.cleanup();
    }
    readinessManagers.delete(itemId);
  }
}

export function renderAccess(
  resolution: AccessResolution,
  options: RenderAccessOptions = {}
): RenderResult {
  const { access, itemType, itemId, title } = resolution;
  
  if (access.mode === 'openweb' && access.openWeb) {
    if (isExternalUrl(access.openWeb)) {
      if (options.walletAddress) {
        logAccessReceipt({
          itemId,
          itemType: itemType as ItemType,
          action: getActionForItemType(itemType as ItemType),
          accessMode: 'openweb',
          accessUri: access.openWeb,
        }, options.walletAddress);
      }
      
      return {
        type: 'redirect',
        url: access.openWeb,
      };
    }
  }
  
  if (access.mode === 'embed' && access.embed) {
    const iframe = document.createElement('iframe');
    iframe.src = access.embed;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allow = 'fullscreen; autoplay; encrypted-media; picture-in-picture';
    iframe.title = title;
    
    if (options.containerRef) {
      options.containerRef.innerHTML = '';
      options.containerRef.appendChild(iframe);
    }
    
    if (options.walletAddress) {
      logAccessReceipt({
        itemId,
        itemType: itemType as ItemType,
        action: getActionForItemType(itemType as ItemType),
        accessMode: 'embed',
        accessFormat: access.format,
        accessUri: access.embed,
      }, options.walletAddress);
    }
    
    return {
      type: 'embed',
      element: iframe,
      cleanup: () => iframe.remove(),
    };
  }
  
  if (access.mode === 'stream' && access.uri) {
    return renderStreamPlayer(access, resolution, options);
  }
  
  if (access.mode === 'file') {
    if (access.format === 'epub' || access.format === 'pdf') {
      return renderReader(access, resolution, options);
    }
    
    if (access.uri) {
      if (options.walletAddress) {
        logAccessReceipt({
          itemId,
          itemType: itemType as ItemType,
          action: 'download',
          accessMode: 'file',
          accessFormat: access.format,
          accessUri: access.uri,
        }, options.walletAddress);
      }
      
      return {
        type: 'redirect',
        url: access.uri,
      };
    }
  }
  
  const errorMsg = `No compatible access method for ${itemType}`;
  options.onError?.(errorMsg);
  
  return {
    type: 'error',
  };
}

function renderStreamPlayer(
  access: AccessManifest,
  resolution: AccessResolution,
  options: RenderAccessOptions
): RenderResult {
  const { itemId, itemType } = resolution;
  
  const video = document.createElement('video');
  video.controls = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.backgroundColor = '#000';
  video.playsInline = true;
  
  if (options.autoplay) {
    video.autoplay = true;
    video.muted = true;
  }
  
  const cleanup = () => {
    video.pause();
    video.src = '';
    video.load();
    video.remove();
  };
  
  if (access.format === 'hls') {
    initHlsPlayer(video, access.uri!, undefined, options.onReady);
  } else if (access.format === 'dash') {
    initDashPlayer(video, access.uri!, undefined, options.onReady);
  } else if (access.format === 'mp4') {
    video.src = access.uri!;
    video.oncanplay = () => options.onReady?.();
  }
  
  if (options.startPosition && options.startPosition > 0) {
    video.currentTime = options.startPosition;
  }
  
  video.ontimeupdate = () => {
    options.onProgress?.(video.currentTime, video.duration);
  };
  
  if (options.containerRef) {
    options.containerRef.innerHTML = '';
    options.containerRef.appendChild(video);
  }
  
  if (options.walletAddress) {
    logAccessReceipt({
      itemId,
      itemType: itemType as ItemType,
      action: 'stream',
      accessMode: 'stream',
      accessFormat: access.format,
      accessUri: access.uri,
    }, options.walletAddress);
  }
  
  return {
    type: 'player',
    element: video,
    cleanup,
  };
}

function initHlsPlayer(
  video: HTMLVideoElement,
  src: string,
  headers?: Record<string, string>,
  onReady?: () => void
): void {
  if ((window as any).Hls && (window as any).Hls.isSupported()) {
    const Hls = (window as any).Hls;
    const hls = new Hls({
      xhrSetup: (xhr: XMLHttpRequest) => {
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }
      },
    });
    
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => onReady?.());
    
    (video as any).__hls = hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    video.oncanplay = () => onReady?.();
  }
}

function initDashPlayer(
  video: HTMLVideoElement,
  src: string,
  headers?: Record<string, string>,
  onReady?: () => void
): void {
  if ((window as any).dashjs) {
    const dashjs = (window as any).dashjs;
    const player = dashjs.MediaPlayer().create();
    
    if (headers) {
      player.extend('RequestModifier', () => ({
        modifyRequestHeader: (xhr: XMLHttpRequest) => {
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
          return xhr;
        },
      }), true);
    }
    
    player.initialize(video, src, false);
    player.on(dashjs.MediaPlayer.events.CAN_PLAY, () => onReady?.());
    
    (video as any).__dashPlayer = player;
  } else {
    video.src = src;
    video.oncanplay = () => onReady?.();
  }
}

function renderReader(
  access: AccessManifest,
  resolution: AccessResolution,
  options: RenderAccessOptions
): RenderResult {
  const { itemId, itemType, title } = resolution;
  
  const container = document.createElement('div');
  container.className = 'atlas-reader-container';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.backgroundColor = '#fff';
  container.style.overflow = 'auto';
  
  if (access.format === 'pdf' && access.uri) {
    const iframe = document.createElement('iframe');
    iframe.src = `${access.uri}#toolbar=1&navpanes=1`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    container.appendChild(iframe);
    
    if (options.walletAddress) {
      logAccessReceipt({
        itemId,
        itemType: itemType as ItemType,
        action: 'read',
        accessMode: 'file',
        accessFormat: 'pdf',
        accessUri: access.uri,
      }, options.walletAddress);
    }
  } else if (access.format === 'epub' && access.uri) {
    const readerMsg = document.createElement('div');
    readerMsg.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;text-align:center;">
        <h3 style="margin-bottom:1rem;">EPUB Reader</h3>
        <p style="color:#666;margin-bottom:1rem;">${title}</p>
        <a href="${access.uri}" target="_blank" rel="noopener" style="padding:0.75rem 1.5rem;background:#007bff;color:#fff;border-radius:0.5rem;text-decoration:none;">
          Download EPUB
        </a>
      </div>
    `;
    container.appendChild(readerMsg);
    
    if (options.walletAddress) {
      logAccessReceipt({
        itemId,
        itemType: itemType as ItemType,
        action: 'read',
        accessMode: 'file',
        accessFormat: 'epub',
        accessUri: access.uri,
      }, options.walletAddress);
    }
  }
  
  if (options.containerRef) {
    options.containerRef.innerHTML = '';
    options.containerRef.appendChild(container);
  }
  
  return {
    type: 'reader',
    element: container,
    cleanup: () => container.remove(),
  };
}

function getActionForItemType(itemType: ItemType): AccessAction {
  switch (itemType) {
    case 'channel':
    case 'video':
      return 'stream';
    case 'audio':
      return 'listen';
    case 'ebook':
    case 'document':
      return 'read';
    case 'game':
    case 'app':
      return 'launch';
    case 'product':
      return 'checkout';
    case 'governance':
      return 'vote';
    case 'gallery':
      return 'browse';
    default:
      return 'view';
  }
}

export function openInBrowser(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function canRenderInline(access: AccessManifest): boolean {
  if (access.mode === 'openweb') return false;
  if (access.mode === 'embed') return true;
  if (access.mode === 'stream') return true;
  if (access.mode === 'file') {
    const inlineFormats = ['pdf', 'epub', 'image', 'mp3', 'aac', 'ogg'];
    return inlineFormats.includes(access.format);
  }
  return false;
}

export function getAccessLabel(access: AccessManifest, itemType: ItemType): string {
  if (access.mode === 'openweb') {
    switch (itemType) {
      case 'game': return 'Play in Browser';
      case 'ebook': return 'Read Online';
      case 'document': return 'View Document';
      case 'product': return 'Shop Now';
      case 'governance': return 'Vote';
      case 'gallery': return 'View Gallery';
      case 'audio': return 'Listen';
      default: return 'Open';
    }
  }
  
  if (access.mode === 'stream') {
    if (itemType === 'channel') return 'Watch Live';
    if (itemType === 'audio') return 'Listen';
    return 'Play';
  }
  
  if (access.mode === 'embed') {
    switch (itemType) {
      case 'game': return 'Play';
      case 'governance': return 'Vote';
      case 'document': return 'View';
      case 'audio': return 'Listen';
      case 'gallery': return 'View';
      default: return 'Open';
    }
  }
  
  if (access.mode === 'file') {
    if (access.format === 'epub' || access.format === 'pdf') return 'Read';
    if (access.format === 'docx' || access.format === 'pptx' || access.format === 'xlsx') return 'View';
    if (access.format === 'image' || access.format === 'gallery') return 'View';
    if (['mp3', 'aac', 'ogg', 'flac'].includes(access.format)) return 'Listen';
    return 'Download';
  }
  
  return 'Open';
}

// Render audio player for podcasts and music
export function renderAudioPlayer(
  access: AccessManifest,
  resolution: AccessResolution,
  options: RenderAccessOptions = {}
): RenderResult {
  const { itemId, itemType, title } = resolution;
  
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.style.width = '100%';
  audio.preload = 'metadata';
  
  if (access.uri) {
    audio.src = access.uri;
  }
  
  const cleanup = () => {
    audio.pause();
    audio.src = '';
    audio.remove();
  };
  
  if (options.containerRef) {
    const container = document.createElement('div');
    container.className = 'atlas-audio-player';
    container.style.padding = '1rem';
    container.style.backgroundColor = '#1a1a1a';
    container.style.borderRadius = '0.5rem';
    
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.color = '#fff';
    titleEl.style.marginBottom = '0.5rem';
    titleEl.style.fontWeight = '500';
    
    container.appendChild(titleEl);
    container.appendChild(audio);
    
    options.containerRef.innerHTML = '';
    options.containerRef.appendChild(container);
  }
  
  if (options.walletAddress) {
    logAccessReceipt({
      itemId,
      itemType: itemType as ItemType,
      action: 'listen',
      accessMode: access.mode,
      accessFormat: access.format,
      accessUri: access.uri,
    }, options.walletAddress);
  }
  
  return {
    type: 'player',
    element: audio,
    cleanup,
  };
}

// Render image or gallery viewer
export function renderGallery(
  access: AccessManifest,
  resolution: AccessResolution,
  options: RenderAccessOptions = {}
): RenderResult {
  const { itemId, itemType, title } = resolution;
  
  const container = document.createElement('div');
  container.className = 'atlas-gallery-viewer';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.backgroundColor = '#000';
  
  if (access.uri) {
    const img = document.createElement('img');
    img.src = access.uri;
    img.alt = title;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    container.appendChild(img);
  }
  
  if (options.containerRef) {
    options.containerRef.innerHTML = '';
    options.containerRef.appendChild(container);
  }
  
  if (options.walletAddress) {
    logAccessReceipt({
      itemId,
      itemType: itemType as ItemType,
      action: 'browse',
      accessMode: access.mode,
      accessFormat: access.format,
      accessUri: access.uri,
    }, options.walletAddress);
  }
  
  return {
    type: 'embed',
    element: container,
    cleanup: () => container.remove(),
  };
}

// ============================================================================
// GRADED ACCESS RENDERING - PENDING, READY, DEGRADED states
// ============================================================================

/**
 * Render graded access with readiness state handling
 * Supports PENDING (loading), READY (optimal), and DEGRADED (fallback) states
 */
export function renderGradedAccess(
  resolution: GradedAccessResolution,
  options: RenderAccessOptions = {}
): RenderResult {
  const { itemId, readiness, fallback } = resolution;
  const manager = getOrCreateManager(itemId);
  
  manager.currentState = readiness;
  options.onReadinessChange?.(readiness);

  if (readiness === 'PENDING') {
    return renderPendingState(resolution, options);
  }

  if (readiness === 'DEGRADED' && fallback) {
    const result = renderAccess(
      { ...resolution, access: fallback },
      options
    );
    
    manager.currentResult = result;
    
    setupUpgradeListener(resolution, options);
    
    return {
      ...result,
      readiness: 'DEGRADED',
      upgrade: () => {
        if (manager.pendingUpgrade) {
          performUpgrade(resolution, manager.pendingUpgrade, options);
        }
      },
    };
  }

  const result = renderAccess(resolution, options);
  manager.currentResult = result;
  
  return {
    ...result,
    readiness: 'READY',
  };
}

/**
 * Render loading/pending state while waiting for access resolution
 */
function renderPendingState(
  resolution: GradedAccessResolution,
  options: RenderAccessOptions
): RenderResult {
  const { itemId, title, itemType } = resolution;
  
  if (!options.containerRef) {
    return { type: 'pending', readiness: 'PENDING' };
  }

  const container = document.createElement('div');
  container.className = 'atlas-pending-access';
  container.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
    gap: 1rem;
  `;
  
  const spinner = document.createElement('div');
  spinner.className = 'atlas-loading-spinner';
  spinner.style.cssText = `
    width: 48px;
    height: 48px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: atlas-spin 1s linear infinite;
  `;
  
  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.cssText = 'font-size: 1.125rem; font-weight: 500;';
  
  const statusEl = document.createElement('div');
  statusEl.textContent = `Preparing ${getItemTypeLabel(itemType)}...`;
  statusEl.style.cssText = 'font-size: 0.875rem; color: rgba(255, 255, 255, 0.6);';
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes atlas-spin {
      to { transform: rotate(360deg); }
    }
  `;
  
  container.appendChild(style);
  container.appendChild(spinner);
  container.appendChild(titleEl);
  container.appendChild(statusEl);
  
  options.containerRef.innerHTML = '';
  options.containerRef.appendChild(container);
  
  setupUpgradeListener(resolution, options);
  
  return {
    type: 'pending',
    element: container,
    readiness: 'PENDING',
    cleanup: () => {
      cleanupManager(itemId);
      container.remove();
    },
  };
}

/**
 * Set up listener for access upgrades via EventSource
 */
function setupUpgradeListener(
  resolution: GradedAccessResolution,
  options: RenderAccessOptions
): void {
  const { itemId } = resolution;
  const manager = getOrCreateManager(itemId);
  
  if (manager.unsubscribe) {
    manager.unsubscribe();
  }
  
  manager.unsubscribe = subscribeAccess((update: AccessUpdate) => {
    if (update.itemId !== itemId) return;
    
    if (update.readiness === 'READY' && update.access) {
      const newAccess: AccessManifest = {
        mode: update.access.mode as AccessMode,
        format: update.access.format as AccessFormat,
        uri: update.access.uri,
        embed: update.access.embed,
        openWeb: update.access.openWeb,
      };
      
      manager.pendingUpgrade = newAccess;
      options.onUpgradeAvailable?.(newAccess);
      
      if (options.autoUpgrade !== false) {
        performUpgrade(resolution, newAccess, options);
      }
    } else if (update.readiness === 'DEGRADED' && manager.currentState === 'PENDING') {
      if (update.fallback) {
        const fallbackAccess: AccessManifest = {
          mode: update.fallback.mode as AccessMode,
          format: update.fallback.format as AccessFormat,
          uri: update.fallback.uri,
          embed: update.fallback.embed,
          openWeb: update.fallback.openWeb,
        };
        
        manager.currentState = 'DEGRADED';
        options.onReadinessChange?.('DEGRADED');
        
        const result = renderAccess(
          { ...resolution, access: fallbackAccess },
          options
        );
        manager.currentResult = result;
      }
    }
  });
}

/**
 * Perform upgrade from DEGRADED to READY state
 */
function performUpgrade(
  resolution: GradedAccessResolution,
  newAccess: AccessManifest,
  options: RenderAccessOptions
): void {
  const { itemId } = resolution;
  const manager = getOrCreateManager(itemId);
  
  if (manager.currentResult?.cleanup) {
    manager.currentResult.cleanup();
  }
  
  manager.currentState = 'READY';
  manager.pendingUpgrade = null;
  options.onReadinessChange?.('READY');
  
  const result = renderAccess(
    { ...resolution, access: newAccess },
    options
  );
  manager.currentResult = result;
}

/**
 * Get human-readable label for item type
 */
function getItemTypeLabel(itemType: ItemType): string {
  const labels: Record<ItemType, string> = {
    channel: 'live stream',
    video: 'video',
    ebook: 'ebook',
    game: 'game',
    product: 'product',
    app: 'app',
    audio: 'audio',
    document: 'document',
    governance: 'proposal',
    gallery: 'gallery',
  };
  return labels[itemType] || 'content';
}

/**
 * Fetch graded access manifest with readiness information
 */
export async function fetchGradedAccessManifest(
  itemId: string
): Promise<GradedAccessResolution | null> {
  try {
    const response = await fetch(`/api/atlas-one/access/${itemId}/graded`);
    if (!response.ok) {
      console.warn(`[AccessRenderer] Failed to fetch graded access for ${itemId}:`, response.status);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error('[AccessRenderer] Error fetching graded access manifest:', err);
    return null;
  }
}

/**
 * Check current readiness state for an item
 */
export function getReadinessState(itemId: string): ReadinessState | null {
  const manager = readinessManagers.get(itemId);
  return manager?.currentState || null;
}

/**
 * Check if an upgrade is available for an item
 */
export function hasUpgradeAvailable(itemId: string): boolean {
  const manager = readinessManagers.get(itemId);
  return manager?.pendingUpgrade !== null;
}

/**
 * Manually trigger upgrade for an item
 */
export function triggerUpgrade(
  itemId: string,
  resolution: GradedAccessResolution,
  options: RenderAccessOptions
): boolean {
  const manager = readinessManagers.get(itemId);
  if (manager?.pendingUpgrade) {
    performUpgrade(resolution, manager.pendingUpgrade, options);
    return true;
  }
  return false;
}

/**
 * Cleanup all readiness managers
 */
export function cleanupAllManagers(): void {
  for (const itemId of readinessManagers.keys()) {
    cleanupManager(itemId);
  }
}

/**
 * Create adaptive fallback UI component
 */
export function createAdaptiveFallbackUI(
  resolution: GradedAccessResolution,
  options: RenderAccessOptions & { onRetry?: () => void }
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'atlas-adaptive-fallback';
  container.style.cssText = `
    padding: 1rem;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  `;
  
  const icon = document.createElement('span');
  icon.textContent = '⚡';
  icon.style.marginRight = '0.5rem';
  
  const text = document.createElement('span');
  text.textContent = 'Playing in compatibility mode. ';
  text.style.color = 'rgba(255, 193, 7, 0.9)';
  
  const upgradeBtn = document.createElement('button');
  upgradeBtn.textContent = 'Upgrade when ready';
  upgradeBtn.style.cssText = `
    background: rgba(255, 193, 7, 0.2);
    border: 1px solid rgba(255, 193, 7, 0.5);
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    color: rgba(255, 193, 7, 0.9);
    cursor: pointer;
    margin-left: 0.5rem;
  `;
  
  upgradeBtn.onclick = () => {
    if (hasUpgradeAvailable(resolution.itemId)) {
      triggerUpgrade(resolution.itemId, resolution, options);
    } else {
      options.onRetry?.();
    }
  };
  
  container.appendChild(icon);
  container.appendChild(text);
  container.appendChild(upgradeBtn);
  
  return container;
}

/**
 * Binary frame decoding utilities for SSE access updates
 */
export interface BinaryAccessFrame {
  itemId: string;
  readiness: ReadinessState;
  access?: AccessManifest;
  fallback?: AccessManifest;
  timestamp: number;
  headers?: Record<string, string>;
}

export function decodeBinaryAccessSSEFrame(base64Data: string): BinaryAccessFrame | null {
  try {
    const binary = decodeBinaryFrame(base64Data);
    const parsed = parseBinaryAccessFrame(binary);
    
    if (!parsed) {
      return null;
    }
    
    return {
      itemId: parsed.itemId,
      readiness: parsed.readiness,
      access: parsed.access ? {
        mode: parsed.access.mode as AccessMode,
        format: parsed.access.format as AccessFormat,
        uri: parsed.access.uri,
        embed: parsed.access.embed,
        openWeb: parsed.access.openWeb,
      } : undefined,
      fallback: parsed.fallback ? {
        mode: parsed.fallback.mode as AccessMode,
        format: parsed.fallback.format as AccessFormat,
        uri: parsed.fallback.uri,
        embed: parsed.fallback.embed,
        openWeb: parsed.fallback.openWeb,
      } : undefined,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error('[AccessRenderer] Failed to decode binary SSE frame:', err);
    return null;
  }
}

export function processBinaryAccessUpdate(
  frame: BinaryAccessFrame,
  options: RenderAccessOptions = {}
): void {
  const manager = readinessManagers.get(frame.itemId);
  if (!manager) return;
  
  const prevState = manager.currentState;
  
  if (frame.readiness === 'READY' && frame.access) {
    manager.pendingUpgrade = frame.access;
    options.onUpgradeAvailable?.(frame.access);
    
    if (options.autoUpgrade !== false && prevState !== 'READY') {
      const resolution: GradedAccessResolution = {
        itemId: frame.itemId,
        itemType: 'video',
        title: '',
        access: frame.access,
        readiness: 'READY',
      };
      performUpgrade(resolution, frame.access, options);
    }
  } else if (frame.readiness === 'DEGRADED' && frame.fallback && prevState === 'PENDING') {
    manager.currentState = 'DEGRADED';
    options.onReadinessChange?.('DEGRADED');
  }
}

export interface BatchAccessRequest {
  itemIds: string[];
  priority?: 'high' | 'normal' | 'low';
}

export interface BatchAccessResponse {
  results: Array<{
    itemId: string;
    readiness: ReadinessState;
    access?: AccessManifest;
    fallback?: AccessManifest;
    eta?: number;
  }>;
  errors?: Array<{
    itemId: string;
    error: string;
  }>;
}

export async function batchFetchAccessManifests(
  request: BatchAccessRequest
): Promise<BatchAccessResponse> {
  try {
    const response = await fetch('/api/atlas-one/access/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`Batch access fetch failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('[AccessRenderer] Batch fetch error:', err);
    return {
      results: [],
      errors: request.itemIds.map(id => ({
        itemId: id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })),
    };
  }
}

export function createReadinessIndicator(
  readiness: ReadinessState,
  options?: {
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    eta?: number;
  }
): HTMLElement {
  const container = document.createElement('div');
  container.className = `atlas-readiness-indicator atlas-readiness-${readiness.toLowerCase()}`;
  
  const sizeMap = {
    sm: '8px',
    md: '12px',
    lg: '16px',
  };
  const size = sizeMap[options?.size || 'md'];
  
  const colorMap: Record<ReadinessState, string> = {
    PENDING: '#f59e0b',
    READY: '#10b981',
    DEGRADED: '#ef4444',
  };
  
  const dot = document.createElement('div');
  dot.style.cssText = `
    width: ${size};
    height: ${size};
    border-radius: 50%;
    background: ${colorMap[readiness]};
    ${readiness === 'PENDING' ? 'animation: atlas-pulse 1.5s ease-in-out infinite;' : ''}
  `;
  container.appendChild(dot);
  
  if (options?.showLabel) {
    const label = document.createElement('span');
    label.textContent = readiness.toLowerCase();
    label.style.cssText = `
      margin-left: 0.5rem;
      font-size: 0.75rem;
      color: ${colorMap[readiness]};
      text-transform: capitalize;
    `;
    container.appendChild(label);
    
    if (readiness === 'PENDING' && options.eta) {
      const etaLabel = document.createElement('span');
      etaLabel.textContent = ` (~${Math.ceil(options.eta / 1000)}s)`;
      etaLabel.style.cssText = 'font-size: 0.75rem; color: rgba(255, 255, 255, 0.5);';
      container.appendChild(etaLabel);
    }
  }
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes atlas-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.9); }
    }
  `;
  container.appendChild(style);
  
  container.style.cssText = 'display: flex; align-items: center;';
  
  return container;
}

export function createUpgradeNotification(
  onUpgrade: () => void,
  onDismiss?: () => void
): HTMLElement {
  const notification = document.createElement('div');
  notification.className = 'atlas-upgrade-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 1rem;
    z-index: 10000;
    animation: atlas-slide-in 0.3s ease-out;
  `;
  
  const icon = document.createElement('span');
  icon.textContent = '⬆️';
  icon.style.fontSize = '1.5rem';
  
  const content = document.createElement('div');
  content.innerHTML = `
    <div style="font-weight: 600;">Higher quality available</div>
    <div style="font-size: 0.875rem; opacity: 0.9;">Click to upgrade playback</div>
  `;
  
  const upgradeBtn = document.createElement('button');
  upgradeBtn.textContent = 'Upgrade';
  upgradeBtn.style.cssText = `
    background: white;
    color: #059669;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.1s;
  `;
  upgradeBtn.onclick = () => {
    onUpgrade();
    notification.remove();
  };
  upgradeBtn.onmouseover = () => upgradeBtn.style.transform = 'scale(1.05)';
  upgradeBtn.onmouseout = () => upgradeBtn.style.transform = 'scale(1)';
  
  if (onDismiss) {
    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = '×';
    dismissBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 1.25rem;
      cursor: pointer;
      opacity: 0.7;
      padding: 0.25rem;
      line-height: 1;
    `;
    dismissBtn.onclick = () => {
      onDismiss();
      notification.remove();
    };
    notification.appendChild(dismissBtn);
  }
  
  notification.appendChild(icon);
  notification.appendChild(content);
  notification.appendChild(upgradeBtn);
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes atlas-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  notification.appendChild(style);
  
  return notification;
}

export interface LaneAccessSubscription {
  itemId: string;
  unsubscribe: () => void;
  onUpdate: (frame: AccessFrame) => void;
}

const laneSubscriptions = new Map<string, LaneAccessSubscription>();

export function subscribeToAccessLane(
  itemId: string,
  options: RenderAccessOptions = {}
): LaneAccessSubscription | null {
  const lanes = getSessionLanes();
  const accessLane = lanes.find(l => l.type === 'access');
  
  if (!accessLane) {
    console.warn('[AccessRenderer] No access lane available');
    return null;
  }

  if (laneSubscriptions.has(itemId)) {
    return laneSubscriptions.get(itemId)!;
  }

  const handleFrame = (frame: AccessFrame) => {
    if (frame.itemId !== itemId) return;
    if (!frame.isValid || isFrameExpired(frame)) {
      console.warn(`[AccessRenderer] Invalid or expired frame for ${itemId}`);
      return;
    }

    const manager = getOrCreateManager(itemId);
    const prevState = manager.currentState;

    if (frame.readiness === 'READY' && frame.access) {
      const accessManifest: AccessManifest = convertAccessPayloadToManifest(frame.access);
      manager.pendingUpgrade = accessManifest;
      options.onUpgradeAvailable?.(accessManifest);

      if (options.autoUpgrade !== false && prevState !== 'READY') {
        const resolution: GradedAccessResolution = {
          itemId: frame.itemId,
          itemType: 'video',
          title: '',
          access: accessManifest,
          readiness: 'READY',
        };
        performUpgrade(resolution, accessManifest, options);
      }
    } else if (frame.readiness === 'DEGRADED' && frame.fallback && prevState === 'PENDING') {
      manager.currentState = 'DEGRADED';
      options.onReadinessChange?.('DEGRADED');
    } else if (frame.readiness === 'PENDING') {
      manager.currentState = 'PENDING';
      options.onReadinessChange?.('PENDING');
    }
  };

  const unsubscribe = accessFrameParser.subscribe(handleFrame);

  const subscription: LaneAccessSubscription = {
    itemId,
    unsubscribe: () => {
      unsubscribe();
      laneSubscriptions.delete(itemId);
    },
    onUpdate: handleFrame,
  };

  laneSubscriptions.set(itemId, subscription);
  return subscription;
}

function convertAccessPayloadToManifest(payload: AccessPayload): AccessManifest {
  const manifest: AccessManifest = {
    mode: payload.mode as AccessMode,
    format: payload.format as AccessFormat,
    uri: payload.uri,
    embed: payload.embed,
    openWeb: payload.openWeb,
  };
  return manifest;
}

export function unsubscribeFromAccessLane(itemId: string): void {
  const subscription = laneSubscriptions.get(itemId);
  if (subscription) {
    subscription.unsubscribe();
  }
}

export function unsubscribeAllAccessLanes(): void {
  for (const subscription of laneSubscriptions.values()) {
    subscription.unsubscribe();
  }
  laneSubscriptions.clear();
}

export function processSSEAccessData(
  data: string,
  options: RenderAccessOptions = {}
): AccessFrame | null {
  let frame: AccessFrame | null = null;

  if (data.startsWith('{')) {
    frame = parseCompactFrame(data);
  } else {
    frame = deserializeAccessFrame(data);
  }

  if (frame && frame.isValid) {
    const manager = readinessManagers.get(frame.itemId);
    if (manager) {
      processBinaryAccessUpdate(
        {
          itemId: frame.itemId,
          readiness: frame.readiness,
          access: frame.access ? convertAccessPayloadToManifest(frame.access) : undefined,
          fallback: frame.fallback ? convertAccessPayloadToManifest(frame.fallback) : undefined,
          timestamp: frame.timestamp,
        },
        options
      );
    }
    return frame;
  }

  return null;
}

export function setupLaneBasedAccessUpdates(
  itemIds: string[],
  options: RenderAccessOptions = {}
): () => void {
  const subscriptions: LaneAccessSubscription[] = [];

  for (const itemId of itemIds) {
    const sub = subscribeToAccessLane(itemId, options);
    if (sub) {
      subscriptions.push(sub);
    }
  }

  return () => {
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
  };
}

export function getActiveAccessSubscriptions(): string[] {
  return Array.from(laneSubscriptions.keys());
}

export function isItemSubscribedToAccessLane(itemId: string): boolean {
  return laneSubscriptions.has(itemId);
}

export type { AccessFrame, AccessPayload } from './wire/accessFrame';
export { FrameFlags } from './wire/accessFrame';
