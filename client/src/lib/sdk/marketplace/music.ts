/**
 * P3 Music SDK
 * Client SDK for music marketplace operations with streaming support
 */

import { Http } from './http';
import type { 
  Asset, 
  License, 
  CheckoutResult, 
  StreamResult, 
  StreamManifest,
  CatalogResponse,
  ExplorerFeed,
  CreateAssetRequest
} from './types';

export class P3MusicSDK {
  private http: Http;
  private appId = 'music-market';

  constructor(http: Http) {
    this.http = http;
    this.http.setAppId(this.appId);
  }

  // ============================================================================
  // Catalog
  // ============================================================================

  async getCatalog(params?: { 
    page?: number; 
    limit?: number; 
    genre?: string;
    artistWallet?: string;
  }): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog', { 
      ...params, 
      type: 'track' 
    });
  }

  async getAlbums(params?: { page?: number; limit?: number }): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog', { 
      ...params, 
      type: 'album' 
    });
  }

  async getTrack(assetId: string): Promise<Asset> {
    return this.http.get(`/api/marketplace/catalog/${assetId}`);
  }

  async search(query: string, limit?: number): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog/search', { 
      q: query, 
      limit 
    });
  }

  async getTrending(): Promise<{ items: Asset[] }> {
    return this.http.get('/api/marketplace/catalog/featured');
  }

  // ============================================================================
  // Gate (Streaming)
  // ============================================================================

  async stream(assetId: string, anchor = true): Promise<StreamResult> {
    return this.http.post('/api/marketplace/gate/stream', {
      assetId,
      appId: this.appId,
      anchor,
    });
  }

  async purchase(assetId: string, anchor = true): Promise<CheckoutResult> {
    return this.http.post('/api/marketplace/gate/checkout', {
      assetId,
      appId: this.appId,
      anchor,
    });
  }

  async getLicense(licenseId: string): Promise<License> {
    return this.http.get(`/api/marketplace/gate/license/${licenseId}`);
  }

  // ============================================================================
  // Content Delivery (Streaming)
  // ============================================================================

  async getStreamManifest(assetId: string, licenseId: string, decryptToken: string): Promise<StreamManifest> {
    const tokenHttp = new Http({
      baseUrl: (this.http as any).baseUrl,
      token: decryptToken,
      appId: this.appId,
    });
    return tokenHttp.get('/api/marketplace/content/stream/manifest', { assetId, licenseId });
  }

  async getSegment(assetId: string, licenseId: string, segmentId: string, decryptToken: string): Promise<{ signedUrl: string }> {
    const tokenHttp = new Http({
      baseUrl: (this.http as any).baseUrl,
      token: decryptToken,
      appId: this.appId,
    });
    return tokenHttp.get('/api/marketplace/content/stream/segment', { 
      assetId, 
      licenseId, 
      segmentId 
    });
  }

  // ============================================================================
  // Artist Studio
  // ============================================================================

  async createTrack(meta: CreateAssetRequest): Promise<{ assetId: string; status: string }> {
    return this.http.post('/api/marketplace/assets', {
      ...meta,
      type: 'track',
    });
  }

  async createAlbum(meta: CreateAssetRequest): Promise<{ assetId: string; status: string }> {
    return this.http.post('/api/marketplace/assets', {
      ...meta,
      type: 'album',
    });
  }

  async uploadAudio(assetId: string, file: File): Promise<{ cid: string; hash: string }> {
    return this.http.upload('/api/marketplace/content/upload', file, { 
      assetId,
      segmentHls: true, // Request HLS segmentation
    });
  }

  async publishTrack(assetId: string): Promise<{ assetId: string; status: string }> {
    return this.http.post(`/api/marketplace/assets/${assetId}/publish`);
  }

  async getMyTracks(): Promise<{ items: Asset[]; total: number }> {
    return this.http.get('/api/marketplace/assets/mine');
  }

  // ============================================================================
  // Explorer (Receipts)
  // ============================================================================

  async getReceipts(filters?: {
    assetId?: string;
    artistWallet?: string;
    listenerWallet?: string;
    page?: number;
    limit?: number;
  }): Promise<ExplorerFeed> {
    return this.http.get('/api/marketplace/explorer/feed', {
      ...filters,
      authorWallet: filters?.artistWallet,
      buyerWallet: filters?.listenerWallet,
    });
  }

  async getStreamStats(assetId: string): Promise<{ totalStreams: number; uniqueListeners: number }> {
    const receipts = await this.http.get<ExplorerFeed>('/api/marketplace/explorer/feed', { 
      assetId,
      eventType: 'stream',
      limit: 1000,
    });
    const uniqueListeners = new Set(receipts.items.map(r => r.buyerWallet)).size;
    return { totalStreams: receipts.total, uniqueListeners };
  }
}
