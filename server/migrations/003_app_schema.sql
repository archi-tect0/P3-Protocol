-- P3 Protocol Database Schema Migration
-- Version: 003
-- Description: App Schema - Application-level tables for messaging, calls, ledger, and user data

-- ============================================================================
-- Create App Schema
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS app;

-- ============================================================================
-- App Messages Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  ipfs_cid TEXT,
  anchored_tx TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_messages_sender ON app.messages(sender);
CREATE INDEX IF NOT EXISTS idx_app_messages_recipient ON app.messages(recipient);
CREATE INDEX IF NOT EXISTS idx_app_messages_content_hash ON app.messages(content_hash);
CREATE INDEX IF NOT EXISTS idx_app_messages_created_at ON app.messages(created_at);

-- ============================================================================
-- App Call Sessions Table
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS app.call_sessions_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS app.call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL,
  participants TEXT[] NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'video', 'screen')),
  metrics JSONB,
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('app.call_sessions_immutable_seq'),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  duration_sec INTEGER
);

CREATE INDEX IF NOT EXISTS idx_app_call_sessions_room_id ON app.call_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_app_call_sessions_immutable_seq ON app.call_sessions(immutable_seq);
CREATE INDEX IF NOT EXISTS idx_app_call_sessions_started_at ON app.call_sessions(started_at);

-- ============================================================================
-- App Ledger Events Table
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS app.ledger_events_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS app.ledger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  amount DECIMAL(20, 8) NOT NULL,
  asset TEXT NOT NULL,
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('app.ledger_events_immutable_seq'),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_ledger_events_tx_hash ON app.ledger_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_app_ledger_events_chain_id ON app.ledger_events(chain_id);
CREATE INDEX IF NOT EXISTS idx_app_ledger_events_direction ON app.ledger_events(direction);
CREATE INDEX IF NOT EXISTS idx_app_ledger_events_immutable_seq ON app.ledger_events(immutable_seq);
CREATE INDEX IF NOT EXISTS idx_app_ledger_events_created_at ON app.ledger_events(created_at);

-- ============================================================================
-- App Allocations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_event_id UUID NOT NULL REFERENCES app.ledger_events(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL CHECK (bucket IN ('ops', 'r&d', 'grants', 'reserve')),
  percent DECIMAL(5, 2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  amount DECIMAL(20, 8) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_allocations_ledger_event_id ON app.allocations(ledger_event_id);
CREATE INDEX IF NOT EXISTS idx_app_allocations_bucket ON app.allocations(bucket);

-- ============================================================================
-- App Notes Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  body_encrypted TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notes_wallet_hash ON app.notes(wallet_hash);
CREATE INDEX IF NOT EXISTS idx_app_notes_created_at ON app.notes(created_at);

-- ============================================================================
-- App Directory Profiles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.directory_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_hash TEXT NOT NULL UNIQUE,
  ens_name TEXT,
  basename TEXT,
  avatar_url TEXT,
  verified_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_directory_profiles_wallet_hash ON app.directory_profiles(wallet_hash);
CREATE INDEX IF NOT EXISTS idx_app_directory_profiles_ens_name ON app.directory_profiles(ens_name);
CREATE INDEX IF NOT EXISTS idx_app_directory_profiles_basename ON app.directory_profiles(basename);
CREATE INDEX IF NOT EXISTS idx_app_directory_profiles_verified_flag ON app.directory_profiles(verified_flag);

-- ============================================================================
-- App Storage Files Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.storage_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_hash TEXT NOT NULL,
  ipfs_cid TEXT NOT NULL,
  keccak256_hash TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ipfs', 'arweave', 'filecoin', 's3')),
  file_size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_storage_files_wallet_hash ON app.storage_files(wallet_hash);
CREATE INDEX IF NOT EXISTS idx_app_storage_files_ipfs_cid ON app.storage_files(ipfs_cid);
CREATE INDEX IF NOT EXISTS idx_app_storage_files_keccak256_hash ON app.storage_files(keccak256_hash);
CREATE INDEX IF NOT EXISTS idx_app_storage_files_provider ON app.storage_files(provider);
CREATE INDEX IF NOT EXISTS idx_app_storage_files_created_at ON app.storage_files(created_at);

-- ============================================================================
-- App Notifications Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_hash TEXT NOT NULL,
  webhook_url_encrypted TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('message', 'call', 'payment', 'receipt', 'governance')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_wallet_hash ON app.notifications(wallet_hash);
CREATE INDEX IF NOT EXISTS idx_app_notifications_event_type ON app.notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_app_notifications_enabled ON app.notifications(enabled);

-- ============================================================================
-- App Inbox Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS app.inbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_hash TEXT NOT NULL,
  message_id UUID NOT NULL REFERENCES app.messages(id) ON DELETE CASCADE,
  archived_flag BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_flag BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_inbox_wallet_hash ON app.inbox(wallet_hash);
CREATE INDEX IF NOT EXISTS idx_app_inbox_message_id ON app.inbox(message_id);
CREATE INDEX IF NOT EXISTS idx_app_inbox_archived_flag ON app.inbox(archived_flag);
CREATE INDEX IF NOT EXISTS idx_app_inbox_deleted_flag ON app.inbox(deleted_flag);
CREATE INDEX IF NOT EXISTS idx_app_inbox_wallet_hash_deleted_archived ON app.inbox(wallet_hash, deleted_flag, archived_flag);

-- ============================================================================
-- Trigger Functions for Updated At Timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_app_notes_updated_at ON app.notes;
CREATE TRIGGER update_app_notes_updated_at BEFORE UPDATE ON app.notes
  FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_directory_profiles_updated_at ON app.directory_profiles;
CREATE TRIGGER update_app_directory_profiles_updated_at BEFORE UPDATE ON app.directory_profiles
  FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_notifications_updated_at ON app.notifications;
CREATE TRIGGER update_app_notifications_updated_at BEFORE UPDATE ON app.notifications
  FOR EACH ROW EXECUTE FUNCTION app.update_updated_at_column();
