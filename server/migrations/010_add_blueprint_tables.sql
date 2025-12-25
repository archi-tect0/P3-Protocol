-- Phase 1-3 Blueprint Tables Migration
-- Adds payments, address_index, zk_messages, and quarantine_items tables

-- Payments table for on-chain payment tracking
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  amount VARCHAR(78) NOT NULL,
  token VARCHAR(42),
  token_symbol VARCHAR(20),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  memo TEXT,
  proof_cid VARCHAR(100),
  gas_used VARCHAR(78),
  block_number INTEGER
);

CREATE INDEX IF NOT EXISTS idx_payments_from ON payments(from_address);
CREATE INDEX IF NOT EXISTS idx_payments_to ON payments(to_address);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Address Index table for wallet address registry
CREATE TABLE IF NOT EXISTS address_index (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  chains JSONB,
  payment_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_address_index_address ON address_index(address);

-- ZK Messages table for encrypted message storage
CREATE TABLE IF NOT EXISTS zk_messages (
  id SERIAL PRIMARY KEY,
  sender VARCHAR(42) NOT NULL,
  recipient VARCHAR(42) NOT NULL,
  cid VARCHAR(100) NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  wrapped_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  tags TEXT[],
  thread_id VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_zk_messages_sender ON zk_messages(sender);
CREATE INDEX IF NOT EXISTS idx_zk_messages_recipient ON zk_messages(recipient);
CREATE INDEX IF NOT EXISTS idx_zk_messages_status ON zk_messages(status);

-- Quarantine Items table for suspicious event management
CREATE TABLE IF NOT EXISTS quarantine_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  sender VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  payload JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  released_at TIMESTAMP,
  released_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantine_items(status);
CREATE INDEX IF NOT EXISTS idx_quarantine_created ON quarantine_items(created_at DESC);

-- Pubkeys table for key management (if not exists)
CREATE TABLE IF NOT EXISTS pubkeys (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  curve25519_pub_b64 TEXT NOT NULL,
  kyber_pub_b64 TEXT,
  kyber_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pubkeys_address ON pubkeys(address);
