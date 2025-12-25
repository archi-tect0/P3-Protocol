-- Migration: 011_wallet_keys.sql
-- Add wallet crypto keys table for persistent server-side encryption keys

CREATE TABLE IF NOT EXISTS wallet_keys (
  id SERIAL PRIMARY KEY,
  wallet VARCHAR(42) UNIQUE NOT NULL,
  encrypted_box_secret TEXT NOT NULL,
  box_public_key TEXT NOT NULL,
  encrypted_sign_secret TEXT NOT NULL,
  sign_public_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_keys_wallet ON wallet_keys(wallet);
