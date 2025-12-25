/**
 * MeshClient Transport Layer
 * 
 * Decentralized streaming mesh network client using Atlas v2 relay as the transport backend.
 * Provides manifest management, chunk dissemination, and event subscription.
 */

import type {
  Session,
  StreamManifest,
  VideoChunk,
  CommentEvent,
  ReactionEvent,
  CID,
} from '@shared/nodestream-types';

const V2_BASE = '/api/atlas/streaming/v2/nodestream';
const POLL_INTERVAL_MS = 5000;

type ManifestCallback = (manifest: StreamManifest) => void;
type EventCallback = (event: CommentEvent | ReactionEvent) => void;

/**
 * Generate a CID (Content Identifier) from binary data using SHA-256
 */
export async function generateCID(data: ArrayBuffer): Promise<CID> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Sign data with session credentials (placeholder for DID signing)
 * In production, this would use the session's private key for cryptographic signing
 */
export async function signData(data: string, session: Session): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data + session.did + session.token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Local chunk cache for offline/fallback access
 */
class ChunkStore {
  private cache = new Map<CID, ArrayBuffer>();
  private maxSize = 100;

  set(cid: CID, data: ArrayBuffer): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cid, data);
  }

  get(cid: CID): ArrayBuffer | undefined {
    return this.cache.get(cid);
  }

  has(cid: CID): boolean {
    return this.cache.has(cid);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * MeshClient - Decentralized streaming transport layer
 * 
 * Uses Atlas v2 relay endpoints for MVP, with architecture ready for WebRTC mesh
 */
export class MeshClient {
  private session: Session;
  private chunkStore = new ChunkStore();
  private manifestCallbacks: ManifestCallback[] = [];
  private eventCallbacks: EventCallback[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastSeenManifestIds = new Set<string>();
  private lastSeenEventIds = new Set<string>();
  private isPolling = false;

  constructor(session: Session) {
    this.session = session;
  }

  /**
   * Get authorization headers for API requests
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.session.token}`,
    };
  }

  /**
   * Announce a new stream manifest to the network
   * POST /api/atlas/streaming/v2/nodestream/manifest
   */
  async announceManifest(manifest: StreamManifest): Promise<{ success: boolean; streamId: string }> {
    const response = await fetch(`${V2_BASE}/manifest`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(manifest),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to announce manifest: ${error.message || response.statusText}`);
    }

    const result = await response.json();
    return { success: true, streamId: result.streamId || manifest.streamId };
  }

  /**
   * Disseminate a video chunk to the network
   * POST /api/atlas/streaming/v2/nodestream/chunk
   */
  async disseminateChunk(chunk: VideoChunk, data: ArrayBuffer): Promise<{ success: boolean; cid: CID }> {
    const cid = await generateCID(data);
    
    this.chunkStore.set(cid, data);

    const formData = new FormData();
    formData.append('metadata', JSON.stringify({ ...chunk, cid }));
    formData.append('data', new Blob([data], { type: 'application/octet-stream' }));

    const response = await fetch(`${V2_BASE}/chunk`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.session.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to disseminate chunk: ${error.message || response.statusText}`);
    }

    return { success: true, cid };
  }

  /**
   * Fetch a chunk by CID from the network, with local cache fallback
   * GET /api/atlas/streaming/v2/nodestream/chunk/:cid
   */
  async fetchChunk(cid: CID): Promise<ArrayBuffer | null> {
    const cached = this.chunkStore.get(cid);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${V2_BASE}/chunk/${cid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.session.token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch chunk: ${response.statusText}`);
      }

      const data = await response.arrayBuffer();
      this.chunkStore.set(cid, data);
      return data;
    } catch (error) {
      console.error('[MeshClient] fetchChunk error:', error);
      return null;
    }
  }

  /**
   * Fetch a stream manifest by stream ID
   * GET /api/atlas/streaming/v2/nodestream/manifest/:streamId
   */
  async fetchManifest(streamId: string): Promise<StreamManifest | null> {
    try {
      const response = await fetch(`${V2_BASE}/manifest/${streamId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[MeshClient] fetchManifest error:', error);
      return null;
    }
  }

  /**
   * Open live fanout channel for real-time streaming
   * Placeholder for future WebRTC implementation
   */
  async openLiveFanout(streamId: string): Promise<{
    send: (chunk: ArrayBuffer) => void;
    close: () => void;
    onChunk: (callback: (chunk: ArrayBuffer, seq: number) => void) => void;
  }> {
    console.log('[MeshClient] openLiveFanout placeholder for stream:', streamId);
    
    const chunkCallbacks: ((chunk: ArrayBuffer, seq: number) => void)[] = [];
    
    return {
      send: (_chunk: ArrayBuffer) => {
        console.warn('[MeshClient] WebRTC fanout not yet implemented - using HTTP fallback');
      },
      close: () => {
        console.log('[MeshClient] Closing fanout channel for:', streamId);
      },
      onChunk: (callback: (chunk: ArrayBuffer, seq: number) => void) => {
        chunkCallbacks.push(callback);
      },
    };
  }

  /**
   * Subscribe to new manifest announcements
   * Uses polling for MVP, will migrate to WebSocket/WebRTC in future
   */
  onManifest(callback: ManifestCallback): () => void {
    this.manifestCallbacks.push(callback);
    this.startPolling();
    
    return () => {
      const index = this.manifestCallbacks.indexOf(callback);
      if (index > -1) {
        this.manifestCallbacks.splice(index, 1);
      }
      this.maybeStopPolling();
    };
  }

  /**
   * Subscribe to events (comments, reactions)
   * Uses polling for MVP, will migrate to WebSocket/WebRTC in future
   */
  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.push(callback);
    this.startPolling();
    
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
      this.maybeStopPolling();
    };
  }

  /**
   * Start polling for new manifests and events
   */
  private startPolling(): void {
    if (this.pollInterval) return;
    
    this.isPolling = true;
    this.pollInterval = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.poll();
  }

  /**
   * Stop polling if no subscribers remain
   */
  private maybeStopPolling(): void {
    if (this.manifestCallbacks.length === 0 && this.eventCallbacks.length === 0) {
      this.stopPolling();
    }
  }

  /**
   * Stop all polling
   */
  private stopPolling(): void {
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Poll for new manifests and events
   */
  private async poll(): Promise<void> {
    if (!this.isPolling) return;

    try {
      if (this.manifestCallbacks.length > 0) {
        const response = await fetch(`${V2_BASE}/manifests/recent`, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (response.ok) {
          const manifests: StreamManifest[] = await response.json();
          for (const manifest of manifests) {
            if (!this.lastSeenManifestIds.has(manifest.streamId)) {
              this.lastSeenManifestIds.add(manifest.streamId);
              for (const cb of this.manifestCallbacks) {
                try {
                  cb(manifest);
                } catch (err) {
                  console.error('[MeshClient] Manifest callback error:', err);
                }
              }
            }
          }
        }
      }

      if (this.eventCallbacks.length > 0) {
        const response = await fetch(`${V2_BASE}/events/recent`, {
          method: 'GET',
          headers: this.getHeaders(),
        });

        if (response.ok) {
          const events: (CommentEvent | ReactionEvent)[] = await response.json();
          for (const event of events) {
            if (!this.lastSeenEventIds.has(event.eventId)) {
              this.lastSeenEventIds.add(event.eventId);
              for (const cb of this.eventCallbacks) {
                try {
                  cb(event);
                } catch (err) {
                  console.error('[MeshClient] Event callback error:', err);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[MeshClient] Poll error:', error);
    }
  }

  /**
   * Update session (e.g., after token refresh)
   */
  updateSession(session: Session): void {
    this.session = session;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopPolling();
    this.manifestCallbacks = [];
    this.eventCallbacks = [];
    this.chunkStore.clear();
    this.lastSeenManifestIds.clear();
    this.lastSeenEventIds.clear();
  }
}

let meshClientInstance: MeshClient | null = null;

/**
 * Get or create the singleton MeshClient instance
 */
export function getMeshClient(session?: Session): MeshClient | null {
  if (session) {
    if (meshClientInstance) {
      meshClientInstance.updateSession(session);
    } else {
      meshClientInstance = new MeshClient(session);
    }
  }
  return meshClientInstance;
}

/**
 * Create a new MeshClient instance (for testing or multiple sessions)
 */
export function createMeshClient(session: Session): MeshClient {
  return new MeshClient(session);
}

/**
 * Destroy the singleton instance
 */
export function destroyMeshClient(): void {
  if (meshClientInstance) {
    meshClientInstance.destroy();
    meshClientInstance = null;
  }
}

export default MeshClient;
