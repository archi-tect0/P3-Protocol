-- P3 Protocol Database Schema Migration
-- Version: 001
-- Description: Initial schema setup with all tables, sequences, and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Users Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- Receipts Table
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS receipts_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('message', 'meeting', 'money')),
  subject_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  proof_blob JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('receipts_immutable_seq'),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_type ON receipts(type);
CREATE INDEX IF NOT EXISTS idx_receipts_subject_id ON receipts(subject_id);
CREATE INDEX IF NOT EXISTS idx_receipts_immutable_seq ON receipts(immutable_seq);
CREATE INDEX IF NOT EXISTS idx_receipts_created_by ON receipts(created_by);

-- ============================================================================
-- Audit Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id ON audit_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type_entity_id ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- Ledger Events Table
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS ledger_events_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS ledger_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tx_hash TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  amount DECIMAL(20, 8) NOT NULL,
  asset TEXT NOT NULL,
  counterparty TEXT NOT NULL,
  memo_hash TEXT,
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('ledger_events_immutable_seq'),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_events_tx_hash ON ledger_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_ledger_events_chain_id ON ledger_events(chain_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_direction ON ledger_events(direction);
CREATE INDEX IF NOT EXISTS idx_ledger_events_immutable_seq ON ledger_events(immutable_seq);

-- ============================================================================
-- Allocations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_event_id UUID NOT NULL REFERENCES ledger_events(id),
  bucket TEXT NOT NULL CHECK (bucket IN ('ops', 'r&d', 'grants', 'reserve')),
  percent DECIMAL(5, 2) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  policy_ref TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_ledger_event_id ON allocations(ledger_event_id);
CREATE INDEX IF NOT EXISTS idx_allocations_bucket ON allocations(bucket);

-- ============================================================================
-- Telemetry Events Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS telemetry_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'click', 'form_submit', 'api_call', 'error')),
  session_id TEXT NOT NULL,
  hashed_ip TEXT NOT NULL,
  geo_region TEXT,
  device TEXT,
  ua_hash TEXT,
  fraud_score DECIMAL(3, 2),
  ts TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_session_id ON telemetry_events(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_ts ON telemetry_events(ts);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_hashed_ip ON telemetry_events(hashed_ip);

-- ============================================================================
-- Wallet Registry Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  deep_link_template TEXT,
  qr_template TEXT,
  installed_check_script TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_registry_wallet_id ON wallet_registry(wallet_id);

-- ============================================================================
-- User Wallet Preferences Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_wallet_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  wallet_id TEXT NOT NULL
);

-- ============================================================================
-- Call Sessions Table
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS call_sessions_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id TEXT NOT NULL,
  participants_hashes TEXT[] NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'video', 'screen')),
  start_tx TEXT,
  end_tx TEXT,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_sec INTEGER,
  metrics_summary JSONB,
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('call_sessions_immutable_seq')
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_room_id ON call_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_immutable_seq ON call_sessions(immutable_seq);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON call_sessions(started_at);

-- ============================================================================
-- Telemetry Voice Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS telemetry_voice (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_hash TEXT NOT NULL,
  session_id TEXT NOT NULL,
  rtt_ms INTEGER,
  jitter_ms INTEGER,
  packets_lost_pct DECIMAL(5, 2),
  bitrate_kbps INTEGER,
  codec TEXT,
  audio_level INTEGER,
  ice_state TEXT,
  ts TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_voice_room_hash ON telemetry_voice(room_hash);
CREATE INDEX IF NOT EXISTS idx_telemetry_voice_session_id ON telemetry_voice(session_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_voice_ts ON telemetry_voice(ts);
