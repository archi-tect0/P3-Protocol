/**
 * P3 Art/NFT SDK
 * Client SDK for art marketplace with editions and provenance
 */

import { Http } from './http';
import type { 
  Asset, 
  License, 
  CheckoutResult,
  DownloadResult,
  CatalogResponse,
  ExplorerFeed,
  CreateAssetRequest
} from './types';

export class P3ArtSDK {
  private http: Http;
  private appId = 'art-market';

  constructor(http: Http) {
    this.http = http;
    this.http.setAppId(this.appId);
  }

  // ============================================================================
  // Gallery Catalog
  // ============================================================================

  async getCatalog(params?: { 
    page?: number; 
    limit?: number; 
    medium?: string;
    artistWallet?: string;
  }): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog', { 
      ...params, 
      type: 'art' 
    });
  }

  async getArtwork(assetId: string): Promise<Asset> {
    return this.http.get(`/api/marketplace/catalog/${assetId}`);
  }

  async search(query: string, limit?: number): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog/search', { 
      q: query, 
      type: 'art',
      limit 
    });
  }

  async getFeatured(): Promise<{ items: Asset[] }> {
    return this.http.get('/api/marketplace/catalog/featured');
  }

  async getByArtist(artistWallet: string): Promise<CatalogResponse> {
    return this.http.get('/api/marketplace/catalog/author/' + artistWallet);
  }

  // ============================================================================
  // Gate (Editions & Licensing)
  // ============================================================================

  async purchase(assetId: string, anchor = true): Promise<CheckoutResult & { editionNumber?: number }> {
    return this.http.post('/api/marketplace/gate/checkout', {
      assetId,
      appId: this.appId,
      anchor,
    });
  }

  async getLicense(licenseId: string): Promise<License & { editionNumber?: number }> {
    return this.http.get(`/api/marketplace/gate/license/${licenseId}`);
  }

  async getEditionStatus(assetId: string): Promise<{ total: number; sold: number; available: number }> {
    const asset = await this.getArtwork(assetId);
    return {
      total: asset.editionTotal || 1,
      sold: asset.editionSold || 0,
      available: (asset.editionTotal || 1) - (asset.editionSold || 0),
    };
  }

  // ============================================================================
  // Content Delivery (High-Res Download)
  // ============================================================================

  async downloadHighRes(licenseId: string, decryptToken: string): Promise<DownloadResult> {
    const tokenHttp = new Http({
      baseUrl: (this.http as any).baseUrl,
      token: decryptToken,
      appId: this.appId,
    });
    return tokenHttp.get('/api/marketplace/content/download', { licenseId });
  }

  async getPreview(assetId: string): Promise<{ previewUrl: string }> {
    const asset = await this.getArtwork(assetId);
    return { previewUrl: asset.previewUrl || '' };
  }

  // ============================================================================
  // Artist Studio
  // ============================================================================

  async createArtwork(meta: CreateAssetRequest & { editionTotal?: number }): Promise<{ assetId: string; status: string }> {
    return this.http.post('/api/marketplace/assets', {
      ...meta,
      type: 'art',
    });
  }

  async uploadArtwork(assetId: string, file: File): Promise<{ cid: string; hash: string }> {
    return this.http.upload('/api/marketplace/content/upload', file, { 
      assetId,
      generatePreview: true,
    });
  }

  async publishArtwork(assetId: string): Promise<{ assetId: string; status: string }> {
    return this.http.post(`/api/marketplace/assets/${assetId}/publish`);
  }

  async getMyArtworks(): Promise<{ items: Asset[]; total: number }> {
    return this.http.get('/api/marketplace/assets/mine');
  }

  async updateArtwork(assetId: string, updates: Partial<CreateAssetRequest>): Promise<Asset> {
    return this.http.patch(`/api/marketplace/assets/${assetId}`, updates);
  }

  // ============================================================================
  // Provenance & Explorer
  // ============================================================================

  async getProvenance(assetId: string): Promise<ExplorerFeed> {
    return this.http.get('/api/marketplace/explorer/asset/' + assetId);
  }

  async getReceipts(filters?: {
    assetId?: string;
    artistWallet?: string;
    collectorWallet?: string;
    page?: number;
    limit?: number;
  }): Promise<ExplorerFeed> {
    return this.http.get('/api/marketplace/explorer/feed', {
      ...filters,
      authorWallet: filters?.artistWallet,
      buyerWallet: filters?.collectorWallet,
    });
  }

  async verifyProvenance(digest: string): Promise<{ valid: boolean; found: boolean; receipt?: unknown }> {
    return this.http.post('/api/marketplace/explorer/verify', { digest });
  }

  async getCollectorProfile(wallet: string): Promise<{ artworks: Asset[]; total: number }> {
    const receipts = await this.http.get<ExplorerFeed>('/api/marketplace/explorer/buyer/' + wallet);
    const assetIds = [...new Set(receipts.items.map(r => r.assetId).filter(Boolean))];
    const artworks: Asset[] = [];
    for (const id of assetIds.slice(0, 20)) {
      try {
        const art = await this.getArtwork(id!);
        artworks.push(art);
      } catch {}
    }
    return { artworks, total: assetIds.length };
  }
}
