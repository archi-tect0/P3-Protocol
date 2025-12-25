/**
 * P3 Video SDK
 * Client SDK for video marketplace operations with HLS streaming
 */

import { Http } from './http';
import type { 
  Asset, 
  License, 
  CheckoutResult,
  BorrowResult,
  StreamResult, 
  StreamManifest,
  CatalogResponse,
  ExplorerFeed,
  CreateAssetRequest
} from './types';

export class P3VideoSDK {
  private http: Http;
  private appId = 'video-market';

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
    creatorWallet?: string;
  }): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog', { 
      ...params, 
      type: 'video' 
    });
  }

  async getVideo(assetId: string): Promise<Asset> {
    return this.http.get(`/api/marketplace/catalog/${assetId}`);
  }

  async search(query: string, limit?: number): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog/search', { 
      q: query, 
      type: 'video',
      limit 
    });
  }

  async getFeatured(): Promise<{ items: Asset[] }> {
    return this.http.get('/api/marketplace/catalog/featured');
  }

  // ============================================================================
  // Gate (Licensing)
  // ============================================================================

  async purchase(assetId: string, anchor = true): Promise<CheckoutResult> {
    return this.http.post('/api/marketplace/gate/checkout', {
      assetId,
      appId: this.appId,
      anchor,
    });
  }

  async rent(assetId: string, hours: number, anchor = true): Promise<BorrowResult> {
    const days = hours / 24;
    return this.http.post('/api/marketplace/gate/borrow', {
      assetId,
      appId: this.appId,
      days,
      anchor,
    });
  }

  async stream(assetId: string, anchor = true): Promise<StreamResult> {
    return this.http.post('/api/marketplace/gate/stream', {
      assetId,
      appId: this.appId,
      anchor,
    });
  }

  async getLicense(licenseId: string): Promise<License> {
    return this.http.get(`/api/marketplace/gate/license/${licenseId}`);
  }

  // ============================================================================
  // Content Delivery (HLS Streaming)
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
  // Creator Studio
  // ============================================================================

  async createVideo(meta: CreateAssetRequest): Promise<{ assetId: string; status: string }> {
    return this.http.post('/api/marketplace/assets', {
      ...meta,
      type: 'video',
    });
  }

  async uploadVideo(assetId: string, file: File): Promise<{ cid: string; hash: string; segments: number }> {
    return this.http.upload('/api/marketplace/content/upload', file, { 
      assetId,
      segmentHls: true,
      generateThumbnail: true,
    });
  }

  async publishVideo(assetId: string): Promise<{ assetId: string; status: string }> {
    return this.http.post(`/api/marketplace/assets/${assetId}/publish`);
  }

  async getMyVideos(): Promise<{ items: Asset[]; total: number }> {
    return this.http.get('/api/marketplace/assets/mine');
  }

  async updateVideo(assetId: string, updates: Partial<CreateAssetRequest>): Promise<Asset> {
    return this.http.patch(`/api/marketplace/assets/${assetId}`, updates);
  }

  // ============================================================================
  // Explorer (Receipts)
  // ============================================================================

  async getReceipts(filters?: {
    assetId?: string;
    creatorWallet?: string;
    viewerWallet?: string;
    page?: number;
    limit?: number;
  }): Promise<ExplorerFeed> {
    return this.http.get('/api/marketplace/explorer/feed', {
      ...filters,
      authorWallet: filters?.creatorWallet,
      buyerWallet: filters?.viewerWallet,
    });
  }

  async getViewStats(assetId: string): Promise<{ totalViews: number; rentals: number; purchases: number }> {
    const receipts = await this.http.get<ExplorerFeed>('/api/marketplace/explorer/feed', { 
      assetId,
      limit: 1000,
    });
    return {
      totalViews: receipts.items.filter(r => r.eventType === 'stream').length,
      rentals: receipts.items.filter(r => r.eventType === 'borrow').length,
      purchases: receipts.items.filter(r => r.eventType === 'checkout').length,
    };
  }
}
