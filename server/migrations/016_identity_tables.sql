-- Migration: 016_identity_tables.sql
-- Description: Add DID documents and reputation tables for identity management

-- DID Documents Table - Decentralized Identity Documents
CREATE TABLE IF NOT EXISTS did_docs (
  id SERIAL PRIMARY KEY,
  wallet_id VARCHAR(128) NOT NULL,
  doc JSONB NOT NULL,
  doc_hash VARCHAR(66) NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Index for faster wallet lookups
CREATE INDEX IF NOT EXISTS idx_did_docs_wallet_id ON did_docs(wallet_id);

-- Index for finding non-revoked documents
CREATE INDEX IF NOT EXISTS idx_did_docs_revoked ON did_docs(revoked) WHERE revoked = FALSE;

-- Reputations Table - Wallet Reputation Scores
CREATE TABLE IF NOT EXISTS reputations (
  wallet_id VARCHAR(128) PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 0,
  reason VARCHAR(256),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for score-based queries (e.g., finding high/low reputation wallets)
CREATE INDEX IF NOT EXISTS idx_reputations_score ON reputations(score);
