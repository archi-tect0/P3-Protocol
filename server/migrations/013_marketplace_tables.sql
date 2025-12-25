-- Migration: 013_marketplace_tables.sql
-- Multi-vertical marketplace infrastructure

-- Marketplace Assets
CREATE TABLE IF NOT EXISTS marketplace_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  author_wallet VARCHAR(42) NOT NULL,
  app_id VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  tags TEXT[],
  metadata_uri TEXT,
  cover_image_cid VARCHAR(100),
  ipfs_cid_enc VARCHAR(100),
  filesize INTEGER,
  mime VARCHAR(100),
  price_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  policy VARCHAR(30) NOT NULL DEFAULT 'perpetual',
  policy_params JSONB,
  split_author_pct INTEGER NOT NULL DEFAULT 85,
  split_marketplace_pct INTEGER NOT NULL DEFAULT 10,
  split_sponsor_pct INTEGER NOT NULL DEFAULT 5,
  encryption_alg VARCHAR(50) DEFAULT 'xchacha20-poly1305',
  envelope_version VARCHAR(10) DEFAULT '1.0',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  parent_asset_id UUID,
  edition_count INTEGER,
  editions_sold INTEGER DEFAULT 0,
  total_downloads INTEGER DEFAULT 0,
  total_streams INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Marketplace Licenses
CREATE TABLE IF NOT EXISTS marketplace_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES marketplace_assets(id),
  buyer_wallet VARCHAR(42) NOT NULL,
  app_id VARCHAR(100) NOT NULL,
  policy VARCHAR(30) NOT NULL,
  expires_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  decrypt_token_jti VARCHAR(64),
  receipt_anchor_id UUID,
  price_paid_usd DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Marketplace Receipts
CREATE TABLE IF NOT EXISTS marketplace_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(30) NOT NULL,
  asset_id UUID REFERENCES marketplace_assets(id),
  buyer_wallet VARCHAR(42),
  author_wallet VARCHAR(42),
  app_id VARCHAR(100) NOT NULL,
  digest VARCHAR(128) NOT NULL,
  tx_hash VARCHAR(100),
  chain VARCHAR(20) DEFAULT 'base',
  status VARCHAR(20) NOT NULL DEFAULT 'submitted',
  anchor_id VARCHAR(100),
  block_number INTEGER,
  confirmations INTEGER DEFAULT 0,
  batch_id VARCHAR(64),
  batch_digests JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Treasury Configs
CREATE TABLE IF NOT EXISTS treasury_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_wallet VARCHAR(42) NOT NULL UNIQUE,
  payout_wallet VARCHAR(42) NOT NULL,
  sponsor_pay_gas BOOLEAN DEFAULT FALSE,
  sponsor_pay_anchor_fees BOOLEAN DEFAULT FALSE,
  settlement_cadence VARCHAR(20) DEFAULT 'weekly',
  split_default_author INTEGER DEFAULT 85,
  split_default_marketplace INTEGER DEFAULT 10,
  split_default_sponsor INTEGER DEFAULT 5,
  total_earned_usd DECIMAL(12,2) DEFAULT 0,
  total_paid_out_usd DECIMAL(12,2) DEFAULT 0,
  pending_payout_usd DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Marketplace Manifests
CREATE TABLE IF NOT EXISTS marketplace_manifests (
  id VARCHAR(100) PRIMARY KEY,
  type VARCHAR(30) NOT NULL DEFAULT 'marketplace',
  category VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon TEXT,
  version VARCHAR(20) NOT NULL,
  routes JSONB NOT NULL,
  api JSONB NOT NULL,
  requirements JSONB,
  capabilities JSONB,
  author_wallet VARCHAR(42),
  signature TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_listed BOOLEAN DEFAULT TRUE,
  ping_status VARCHAR(20) DEFAULT 'unknown',
  last_ping_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Marketplace Settlements
CREATE TABLE IF NOT EXISTS marketplace_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_wallet VARCHAR(42) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_gross_usd DECIMAL(12,2) NOT NULL,
  author_payout_usd DECIMAL(12,2) NOT NULL,
  marketplace_fee_usd DECIMAL(12,2) NOT NULL,
  anchor_fees_paid_usd DECIMAL(12,2) DEFAULT 0,
  tx_hash VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  anchor_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Stream Batches
CREATE TABLE IF NOT EXISTS stream_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(100) NOT NULL,
  asset_id UUID REFERENCES marketplace_assets(id),
  author_wallet VARCHAR(42) NOT NULL,
  play_count INTEGER NOT NULL DEFAULT 0,
  play_digests JSONB,
  batch_digest VARCHAR(128),
  anchor_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_assets_author ON marketplace_assets(author_wallet);
CREATE INDEX IF NOT EXISTS idx_marketplace_assets_type ON marketplace_assets(type);
CREATE INDEX IF NOT EXISTS idx_marketplace_assets_status ON marketplace_assets(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_assets_app ON marketplace_assets(app_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_licenses_buyer ON marketplace_licenses(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_marketplace_licenses_asset ON marketplace_licenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_receipts_asset ON marketplace_receipts(asset_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_receipts_buyer ON marketplace_receipts(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_marketplace_receipts_status ON marketplace_receipts(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_manifests_category ON marketplace_manifests(category);
CREATE INDEX IF NOT EXISTS idx_stream_batches_asset ON stream_batches(asset_id);
CREATE INDEX IF NOT EXISTS idx_stream_batches_status ON stream_batches(status);
