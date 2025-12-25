/**
 * P3 Marketplace SDK
 * Unified SDK for all marketplace verticals
 */

import { Http } from './http';
import { P3EbookSDK } from './ebook';
import { P3MusicSDK } from './music';
import { P3VideoSDK } from './video';
import { P3ArtSDK } from './art';

export * from './types';
export * from './http';
export { P3EbookSDK } from './ebook';
export { P3MusicSDK } from './music';
export { P3VideoSDK } from './video';
export { P3ArtSDK } from './art';

export type SettleMode = 'BASE_USDC' | 'BASE_DIRECT' | 'RELAY_LZ' | 'RELAY_WH';
export type RelayStatus = 'pending' | 'confirmed' | 'failed';

export interface SettlementInfo {
  mode: SettleMode;
  originChain: string;
  txHashBase?: string;
  relayStatus: RelayStatus;
}

export interface CheckoutOptions {
  assetId: string;
  appId?: string;
  anchor?: boolean;
  settleMode?: SettleMode;
  originChain?: string;
  feeCurrency?: string;
}

export interface StreamOptions {
  assetId: string;
  appId?: string;
  anchor?: boolean;
  settleMode?: SettleMode;
  originChain?: string;
  feeCurrency?: string;
}

export interface BorrowOptions {
  assetId: string;
  days: number;
  appId?: string;
  anchor?: boolean;
  settleMode?: SettleMode;
  originChain?: string;
  feeCurrency?: string;
}

export interface CheckoutResult {
  licenseId: string;
  decryptToken: string;
  existing?: boolean;
  settlement?: SettlementInfo;
}

export interface StreamResult {
  playId: string;
  decryptToken: string;
  settlement?: SettlementInfo;
}

export interface BorrowResult {
  licenseId: string;
  expiresAt: string;
  decryptToken: string;
  settlement?: SettlementInfo;
}

export interface P3MarketplaceConfig {
  baseUrl?: string;
  token?: string;
  walletAddress?: string;
}

export class P3Marketplace {
  private http: Http;
  
  public readonly ebook: P3EbookSDK;
  public readonly music: P3MusicSDK;
  public readonly video: P3VideoSDK;
  public readonly art: P3ArtSDK;

  constructor(config: P3MarketplaceConfig = {}) {
    const baseUrl = config.baseUrl || import.meta.env.VITE_API_BASE || window.location.origin;
    
    this.http = new Http({
      baseUrl,
      token: config.token,
      walletAddress: config.walletAddress,
    });

    this.ebook = new P3EbookSDK(this.http);
    this.music = new P3MusicSDK(this.http);
    this.video = new P3VideoSDK(this.http);
    this.art = new P3ArtSDK(this.http);
  }

  setAuth(token: string, walletAddress?: string): void {
    this.http.setAuth(token, walletAddress);
  }

  // ============================================================================
  // Cross-Vertical APIs
  // ============================================================================

  async getManifests(): Promise<{ items: unknown[] }> {
    return this.http.get('/api/marketplace/manifest');
  }

  async getManifest(id: string): Promise<unknown> {
    return this.http.get(`/api/marketplace/manifest/${id}`);
  }

  async getCategories(): Promise<{ categories: { id: string; name: string; icon: string }[] }> {
    return this.http.get('/api/marketplace/manifest/meta/categories');
  }

  async getHealth(): Promise<{ ok: boolean; service: string; version: string }> {
    return this.http.get('/api/marketplace/health');
  }

  async getStats(): Promise<{ 
    totalAssets: number; 
    published: number; 
    byType: Record<string, number>;
    totalDownloads: number;
    totalStreams: number;
  }> {
    return this.http.get('/api/marketplace/stats');
  }

  // ============================================================================
  // Treasury APIs
  // ============================================================================

  async initTreasury(config?: {
    payoutWallet?: string;
    sponsorPolicy?: { payGas?: boolean; payAnchorFees?: boolean };
    splitDefault?: { authorPct?: number; marketplacePct?: number; sponsorPct?: number };
  }): Promise<{ authorId: string; treasuryConfig: unknown }> {
    return this.http.post('/api/marketplace/treasury/init', config);
  }

  async getTreasuryStatement(): Promise<{
    totalEarned: string;
    totalPaidOut: string;
    pending: string;
    settlementCadence: string;
    recentSettlements: unknown[];
  }> {
    return this.http.get('/api/marketplace/treasury/statement');
  }

  async updateSponsorPolicy(policy: { payGas?: boolean; payAnchorFees?: boolean }): Promise<unknown> {
    return this.http.post('/api/marketplace/treasury/policy', policy);
  }

  // ============================================================================
  // Audit APIs
  // ============================================================================

  async exportAuditBundle(options: {
    scope?: 'all' | 'ebooks' | 'music' | 'video' | 'art';
    from?: string | number;
    to?: string | number;
    format?: 'json' | 'csv';
  }): Promise<{
    bundle: unknown;
    digest: string;
    signature: string;
    downloadUrl: string;
  }> {
    return this.http.post('/api/marketplace/audit/export', options);
  }

  async verifyAuditBundle(bundle: unknown, digest: string, signature: string): Promise<{ valid: boolean; reason?: string }> {
    return this.http.post('/api/marketplace/audit/verify', { bundle, digest, signature });
  }

  async getAuditSummary(days?: number): Promise<{
    period: { days: number; from: string; to: string };
    totalReceipts: number;
    anchored: number;
    pending: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    return this.http.get('/api/marketplace/audit/summary', { days });
  }

  // ============================================================================
  // Gate APIs (with cross-chain settlement support)
  // ============================================================================

  async checkout(options: CheckoutOptions): Promise<CheckoutResult> {
    return this.http.post('/api/marketplace/gate/checkout', {
      assetId: options.assetId,
      appId: options.appId || 'p3-marketplace',
      anchor: options.anchor ?? true,
      settleMode: options.settleMode || 'BASE_USDC',
      originChain: options.originChain || 'base',
      feeCurrency: options.feeCurrency || 'USDC',
    });
  }

  async stream(options: StreamOptions): Promise<StreamResult> {
    return this.http.post('/api/marketplace/gate/stream', {
      assetId: options.assetId,
      appId: options.appId || 'p3-marketplace',
      anchor: options.anchor ?? true,
      settleMode: options.settleMode || 'BASE_USDC',
      originChain: options.originChain || 'base',
      feeCurrency: options.feeCurrency || 'USDC',
    });
  }

  async borrow(options: BorrowOptions): Promise<BorrowResult> {
    return this.http.post('/api/marketplace/gate/borrow', {
      assetId: options.assetId,
      days: options.days,
      appId: options.appId || 'p3-marketplace',
      anchor: options.anchor ?? true,
      settleMode: options.settleMode || 'BASE_USDC',
      originChain: options.originChain || 'base',
      feeCurrency: options.feeCurrency || 'USDC',
    });
  }

  async getLicenseStatus(licenseId: string): Promise<{
    id: string;
    status: string;
    policy: string;
    expiresAt?: string;
  }> {
    return this.http.get(`/api/marketplace/gate/license/${licenseId}`);
  }

  async verifyToken(token: string): Promise<{ valid: boolean; claims?: unknown }> {
    return this.http.post('/api/marketplace/gate/verify', { token });
  }

  // ============================================================================
  // Settlement APIs
  // ============================================================================

  async getSettlementStatus(licenseId: string): Promise<{
    licenseId: string;
    settleMode: SettleMode;
    originChain: string;
    feeCurrency: string;
    txHashBase?: string;
    relayStatus: RelayStatus;
  }> {
    return this.http.get(`/api/marketplace/settlement/status/${licenseId}`);
  }

  async updateRelayStatus(licenseId: string, status: {
    relayStatus: RelayStatus;
    txHashBase?: string;
  }): Promise<{
    licenseId: string;
    relayStatus: RelayStatus;
    txHashBase?: string;
  }> {
    return this.http.patch(`/api/marketplace/settlement/relay/${licenseId}`, status);
  }

  async getSupportedChains(): Promise<{
    supported: Array<{
      id: string;
      name: string;
      chainId: number;
      isDestination?: boolean;
      relayModes?: SettleMode[];
    }>;
    settleModes: SettleMode[];
    feeCurrencies: string[];
  }> {
    return this.http.get('/api/marketplace/settlement/chains');
  }

  async processSettlement(params: {
    licenseId: string;
    assetId: string;
    buyerWallet: string;
    authorWallet: string;
    amountUsd: number;
    settleMode: SettleMode;
    originChain: string;
    feeCurrency?: string;
  }): Promise<{
    success: boolean;
    txHashBase?: string;
    relayStatus: RelayStatus;
    error?: string;
    anchorId?: string;
  }> {
    return this.http.post('/api/marketplace/settlement/process', params);
  }
}

export function createMarketplaceSDK(config?: P3MarketplaceConfig): P3Marketplace {
  return new P3Marketplace(config);
}

export default P3Marketplace;
