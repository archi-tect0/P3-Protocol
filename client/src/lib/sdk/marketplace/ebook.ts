/**
 * P3 Ebook SDK
 * Client SDK for ebook marketplace operations
 */

import { Http } from './http';
import type { 
  Asset, 
  License, 
  CheckoutResult, 
  BorrowResult, 
  DownloadResult,
  CatalogResponse,
  ExplorerFeed,
  CreateAssetRequest
} from './types';

export class P3EbookSDK {
  private http: Http;
  private appId = 'ebook-market';

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
    category?: string;
    authorWallet?: string;
  }): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog', { 
      ...params, 
      type: 'ebook' 
    });
  }

  async getAsset(assetId: string): Promise<Asset> {
    return this.http.get(`/api/marketplace/catalog/${assetId}`);
  }

  async search(query: string, limit?: number): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog/search', { 
      q: query, 
      type: 'ebook',
      limit 
    });
  }

  async getFeatured(): Promise<{ items: Asset[] }> {
    return this.http.get('/api/marketplace/catalog/featured');
  }

  // ============================================================================
  // Gate (Licensing)
  // ============================================================================

  async checkout(assetId: string, anchor = true): Promise<CheckoutResult> {
    return this.http.post('/api/marketplace/gate/checkout', {
      assetId,
      appId: this.appId,
      anchor,
    });
  }

  async borrow(assetId: string, days: number, anchor = true): Promise<BorrowResult> {
    return this.http.post('/api/marketplace/gate/borrow', {
      assetId,
      appId: this.appId,
      days,
      anchor,
    });
  }

  async getLicense(licenseId: string): Promise<License> {
    return this.http.get(`/api/marketplace/gate/license/${licenseId}`);
  }

  async verifyToken(token: string): Promise<{ valid: boolean; claims?: unknown }> {
    return this.http.post('/api/marketplace/gate/verify', { token });
  }

  // ============================================================================
  // Content Delivery
  // ============================================================================

  async download(licenseId: string, decryptToken: string): Promise<DownloadResult> {
    const tokenHttp = new Http({
      baseUrl: (this.http as any).baseUrl,
      token: decryptToken,
      appId: this.appId,
    });
    return tokenHttp.get('/api/marketplace/content/download', { licenseId });
  }

  // ============================================================================
  // Author Portal
  // ============================================================================

  async createAsset(meta: CreateAssetRequest): Promise<{ assetId: string; status: string }> {
    return this.http.post('/api/marketplace/assets', {
      ...meta,
      type: 'ebook',
    });
  }

  async uploadContent(assetId: string, file: File): Promise<{ cid: string; hash: string }> {
    return this.http.upload('/api/marketplace/content/upload', file, { assetId });
  }

  async publishAsset(assetId: string): Promise<{ assetId: string; status: string }> {
    return this.http.post(`/api/marketplace/assets/${assetId}/publish`);
  }

  async getMyAssets(): Promise<{ items: Asset[]; total: number }> {
    return this.http.get('/api/marketplace/assets/mine');
  }

  async updateAsset(assetId: string, updates: Partial<CreateAssetRequest>): Promise<Asset> {
    return this.http.patch(`/api/marketplace/assets/${assetId}`, updates);
  }

  async unpublishAsset(assetId: string): Promise<{ success: boolean }> {
    return this.http.post(`/api/marketplace/assets/${assetId}/unpublish`);
  }

  // ============================================================================
  // Explorer (Receipts)
  // ============================================================================

  async getReceipts(filters?: {
    assetId?: string;
    authorWallet?: string;
    buyerWallet?: string;
    page?: number;
    limit?: number;
  }): Promise<ExplorerFeed> {
    return this.http.get('/api/marketplace/explorer/feed', filters);
  }

  async verifyReceipt(digest: string): Promise<{ valid: boolean; found: boolean; receipt?: unknown }> {
    return this.http.post('/api/marketplace/explorer/verify', { digest });
  }
}
