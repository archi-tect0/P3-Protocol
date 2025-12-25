/**
 * Atlas One Types
 */

export type ExperienceKind = 'game' | 'video' | 'ebook' | 'app' | 'product' | 'audio';

export interface AtlasOneItem {
  id: string;
  kind: ExperienceKind;
  title: string;
  slug: string;
  description?: string;
  thumbnail?: string;
  coverImage?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  priceWei?: string;
  currency: string;
  status: 'draft' | 'published' | 'archived' | 'suspended';
  featured: boolean;
  rating?: number;
  downloads: number;
  purchases: number;
  creatorWallet: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface AtlasOneAccess {
  id: string;
  wallet: string;
  itemId: string;
  kind: ExperienceKind;
  accessType: 'rental' | 'purchase' | 'subscription' | 'free';
  priceWei?: string;
  expiresAt?: Date;
  progress?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AtlasOneSearchFilters {
  kind?: ExperienceKind;
  category?: string;
  tags?: string[];
  search?: string;
  status?: 'draft' | 'published' | 'archived' | 'suspended';
  featured?: boolean;
  creatorWallet?: string;
  limit?: number;
  offset?: number;
}

export interface AtlasOneSearchResult {
  items: AtlasOneItem[];
  count: number;
  filters: AtlasOneSearchFilters;
}

export interface AtlasOneLibraryResult {
  items: AtlasOneAccess[];
  count: number;
  wallet: string;
}

export interface AtlasOneContinueItem {
  access: AtlasOneAccess;
  item: AtlasOneItem;
  lastActivity: Date;
}

export interface AtlasOneVoiceCommand {
  action: 'launch' | 'watch' | 'rent' | 'purchase' | 'play' | 'read' | 'show' | 'search' | 'open';
  target?: string;
  kind?: ExperienceKind;
  query?: string;
}

export type LensType = 'card' | 'quickview' | 'playback';

export interface LensDelta {
  itemId: string;
  lensType: LensType;
  version: number;
  previousVersion?: number;
  changedFields: string[];
  payload: Record<string, unknown>;
}

export interface ViewportBatchRequest {
  sessionId: string;
  itemIds: string[];
  lensType: LensType;
  clientVersions?: Record<string, number>;
}

export interface ViewportBatchResponse {
  items: Array<{
    itemId: string;
    lens: Record<string, unknown>;
    version: number;
    delta?: LensDelta;
  }>;
  count: number;
}
