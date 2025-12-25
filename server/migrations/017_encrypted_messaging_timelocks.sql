-- Migration 017: Add encrypted messages and guardian timelocks tables
-- Description: Adds tables for E2E encrypted messaging and guardian timelock actions

-- Create encrypted_messages table for E2E encrypted messaging
CREATE TABLE IF NOT EXISTS encrypted_messages (
  id SERIAL PRIMARY KEY,
  from_wallet_id VARCHAR(128) NOT NULL,
  to_wallet_id VARCHAR(128) NOT NULL,
  ciphertext JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_encrypted_messages_to_wallet ON encrypted_messages(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_messages_from_wallet ON encrypted_messages(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_messages_created_at ON encrypted_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_encrypted_messages_expires_at ON encrypted_messages(expires_at);

-- Create guardian_timelocks table for guardian timelock actions
CREATE TABLE IF NOT EXISTS guardian_timelocks (
  id SERIAL PRIMARY KEY,
  action VARCHAR(128) NOT NULL,
  execute_after_sec INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  executed BOOLEAN DEFAULT FALSE
);

-- Create index for timelock queries
CREATE INDEX IF NOT EXISTS idx_guardian_timelocks_executed ON guardian_timelocks(executed);
CREATE INDEX IF NOT EXISTS idx_guardian_timelocks_created_at ON guardian_timelocks(created_at);
