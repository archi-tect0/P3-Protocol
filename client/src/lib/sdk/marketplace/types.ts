/**
 * P3 Marketplace Types
 */

export type AssetType = 'ebook' | 'track' | 'album' | 'video' | 'course' | 'game' | 'dataset' | 'art';
export type AssetPolicy = 'perpetual' | 'lend_days' | 'stream_ppv' | 'rent_hours' | 'subscription';
export type AssetStatus = 'draft' | 'published' | 'unlisted' | 'deleted';
export type ReceiptStatus = 'queued' | 'submitted' | 'confirmed' | 'failed';
export type LicenseStatus = 'active' | 'expired' | 'revoked';

export interface Asset {
  id: string;
  type: AssetType;
  authorWallet: string;
  title: string;
  description: string;
  tags: string[];
  priceUsd: string;
  policy: AssetPolicy;
  splitAuthorPct: number;
  splitMarketplacePct: number;
  splitSponsorPct: number;
  ipfsCidEnc?: string;
  r2Key?: string;
  metadataUri?: string;
  coverUrl?: string;
  previewUrl?: string;
  mime?: string;
  filesize?: number;
  encryptionAlg: string;
  envelopeVersion: string;
  category?: string;
  editionTotal?: number;
  editionSold?: number;
  totalDownloads: number;
  totalStreams: number;
  status: AssetStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface License {
  id: string;
  assetId: string;
  buyerWallet: string;
  appId: string;
  policy: AssetPolicy;
  pricePaidUsd: string;
  status: LicenseStatus;
  expiresAt?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  eventType: string;
  assetId?: string;
  buyerWallet?: string;
  authorWallet?: string;
  appId?: string;
  digest: string;
  txHash?: string;
  blockNumber?: number;
  confirmations?: number;
  status: ReceiptStatus;
  createdAt: string;
}

export interface CheckoutResult {
  licenseId: string;
  decryptToken: string;
  existing?: boolean;
}

export interface BorrowResult {
  licenseId: string;
  expiresAt: string;
  decryptToken: string;
}

export interface StreamResult {
  playId: string;
  decryptToken: string;
}

export interface DownloadResult {
  signedUrl: string;
  ipfsCidEnc: string;
  envelopeMeta: {
    alg: string;
    version: string;
  };
  mime: string;
  filesize: number;
}

export interface StreamManifest {
  hlsManifestUrl: string;
  dashManifestUrl?: string;
  duration?: number;
}

export interface Manifest {
  id: string;
  type: 'marketplace' | 'app' | 'game' | 'tool';
  category: string;
  title: string;
  description?: string;
  icon?: string;
  version: string;
  routes: Record<string, string>;
  api: {
    baseUrl: string;
    ping: string;
    assets?: string;
    checkout?: string;
    content?: string;
    explorer?: string;
  };
  requirements: {
    wallet?: boolean;
    ticketGate?: boolean;
    anchorReceipts?: boolean;
  };
  capabilities?: Record<string, boolean>;
}

export interface CatalogResponse {
  items: Asset[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ExplorerFeed {
  items: Receipt[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface TreasuryStatement {
  totalEarned: string;
  totalPaidOut: string;
  pending: string;
  settlementCadence: string;
  recentSettlements: unknown[];
}

export interface AuditBundle {
  scope: string;
  from: string;
  to: string;
  count: number;
  receipts: Receipt[];
}

export interface CreateAssetRequest {
  type: AssetType;
  title: string;
  description?: string;
  tags?: string[];
  priceUsd: number;
  policy?: AssetPolicy;
  split?: {
    authorPct: number;
    marketplacePct: number;
    sponsorPct: number;
  };
  envelope?: {
    alg?: string;
    version?: string;
  };
  editionTotal?: number;
  category?: string;
  coverUrl?: string;
  previewUrl?: string;
}
