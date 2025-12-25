-- P3 Protocol Database Schema Migration
-- Version: 004
-- Description: Trust Schema - Trust layer tables for consensus, proofs, and governance

-- ============================================================================
-- Create Trust Schema
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS trust;

-- ============================================================================
-- Trust Consent Records Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_hash TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  consent_hash TEXT NOT NULL UNIQUE,
  witness_signatures JSONB NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_consent_records_user_hash ON trust.consent_records(user_hash);
CREATE INDEX IF NOT EXISTS idx_trust_consent_records_policy_hash ON trust.consent_records(policy_hash);
CREATE INDEX IF NOT EXISTS idx_trust_consent_records_consent_hash ON trust.consent_records(consent_hash);
CREATE INDEX IF NOT EXISTS idx_trust_consent_records_granted_at ON trust.consent_records(granted_at);
CREATE INDEX IF NOT EXISTS idx_trust_consent_records_revoked_at ON trust.consent_records(revoked_at);

-- ============================================================================
-- Trust Meeting Proofs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.meeting_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id TEXT NOT NULL UNIQUE,
  participants_hashes TEXT[] NOT NULL,
  signatures JSONB NOT NULL,
  metadata_hash TEXT NOT NULL,
  anchor_tx TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_meeting_proofs_meeting_id ON trust.meeting_proofs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_trust_meeting_proofs_metadata_hash ON trust.meeting_proofs(metadata_hash);
CREATE INDEX IF NOT EXISTS idx_trust_meeting_proofs_anchor_tx ON trust.meeting_proofs(anchor_tx);
CREATE INDEX IF NOT EXISTS idx_trust_meeting_proofs_created_at ON trust.meeting_proofs(created_at);

-- ============================================================================
-- Trust Anchor Bundles Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.anchor_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id TEXT NOT NULL UNIQUE,
  merkle_root TEXT NOT NULL,
  events_json JSONB NOT NULL,
  proofs_json JSONB NOT NULL,
  anchor_tx TEXT,
  anchored_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_anchor_bundles_bundle_id ON trust.anchor_bundles(bundle_id);
CREATE INDEX IF NOT EXISTS idx_trust_anchor_bundles_merkle_root ON trust.anchor_bundles(merkle_root);
CREATE INDEX IF NOT EXISTS idx_trust_anchor_bundles_anchor_tx ON trust.anchor_bundles(anchor_tx);
CREATE INDEX IF NOT EXISTS idx_trust_anchor_bundles_anchored_at ON trust.anchor_bundles(anchored_at);
CREATE INDEX IF NOT EXISTS idx_trust_anchor_bundles_created_at ON trust.anchor_bundles(created_at);

-- ============================================================================
-- Trust External Anchors Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.external_anchors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  tx_hash TEXT,
  verified_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_external_anchors_app_id ON trust.external_anchors(app_id);
CREATE INDEX IF NOT EXISTS idx_trust_external_anchors_event_type ON trust.external_anchors(event_type);
CREATE INDEX IF NOT EXISTS idx_trust_external_anchors_event_hash ON trust.external_anchors(event_hash);
CREATE INDEX IF NOT EXISTS idx_trust_external_anchors_tx_hash ON trust.external_anchors(tx_hash);
CREATE INDEX IF NOT EXISTS idx_trust_external_anchors_verified_flag ON trust.external_anchors(verified_flag);
CREATE INDEX IF NOT EXISTS idx_trust_external_anchors_created_at ON trust.external_anchors(created_at);

-- ============================================================================
-- Trust Receipts Unified Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.receipts_unified (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_hash TEXT NOT NULL UNIQUE,
  l2_tx TEXT,
  l1_checkpoint_tx TEXT,
  chain_mirrors_json JSONB,
  finalized_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trust_receipts_unified_doc_hash ON trust.receipts_unified(doc_hash);
CREATE INDEX IF NOT EXISTS idx_trust_receipts_unified_l2_tx ON trust.receipts_unified(l2_tx);
CREATE INDEX IF NOT EXISTS idx_trust_receipts_unified_l1_checkpoint_tx ON trust.receipts_unified(l1_checkpoint_tx);
CREATE INDEX IF NOT EXISTS idx_trust_receipts_unified_finalized_flag ON trust.receipts_unified(finalized_flag);
CREATE INDEX IF NOT EXISTS idx_trust_receipts_unified_created_at ON trust.receipts_unified(created_at);

-- ============================================================================
-- Trust ZK Proofs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.zk_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_name TEXT NOT NULL,
  public_signals_json JSONB NOT NULL,
  proof_blob_cid TEXT NOT NULL,
  verified_flag BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_zk_proofs_circuit_name ON trust.zk_proofs(circuit_name);
CREATE INDEX IF NOT EXISTS idx_trust_zk_proofs_proof_blob_cid ON trust.zk_proofs(proof_blob_cid);
CREATE INDEX IF NOT EXISTS idx_trust_zk_proofs_verified_flag ON trust.zk_proofs(verified_flag);
CREATE INDEX IF NOT EXISTS idx_trust_zk_proofs_created_at ON trust.zk_proofs(created_at);

-- ============================================================================
-- Trust DAO Proposals Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.dao_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  actions_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'succeeded', 'defeated', 'executed', 'cancelled')),
  votes_for DECIMAL(20, 8) NOT NULL DEFAULT 0,
  votes_against DECIMAL(20, 8) NOT NULL DEFAULT 0,
  votes_abstain DECIMAL(20, 8) NOT NULL DEFAULT 0,
  executed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  voting_starts_at TIMESTAMP,
  voting_ends_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trust_dao_proposals_proposal_id ON trust.dao_proposals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_trust_dao_proposals_status ON trust.dao_proposals(status);
CREATE INDEX IF NOT EXISTS idx_trust_dao_proposals_created_at ON trust.dao_proposals(created_at);
CREATE INDEX IF NOT EXISTS idx_trust_dao_proposals_voting_ends_at ON trust.dao_proposals(voting_ends_at);
CREATE INDEX IF NOT EXISTS idx_trust_dao_proposals_executed_at ON trust.dao_proposals(executed_at);

-- ============================================================================
-- Trust Bridge Jobs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust.bridge_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT NOT NULL UNIQUE,
  doc_hash TEXT NOT NULL,
  targets TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_bridge_jobs_job_id ON trust.bridge_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_trust_bridge_jobs_doc_hash ON trust.bridge_jobs(doc_hash);
CREATE INDEX IF NOT EXISTS idx_trust_bridge_jobs_status ON trust.bridge_jobs(status);
CREATE INDEX IF NOT EXISTS idx_trust_bridge_jobs_created_at ON trust.bridge_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_trust_bridge_jobs_completed_at ON trust.bridge_jobs(completed_at);

-- ============================================================================
-- Trigger Functions for Updated At Timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION trust.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trust_bridge_jobs_updated_at ON trust.bridge_jobs;
CREATE TRIGGER update_trust_bridge_jobs_updated_at BEFORE UPDATE ON trust.bridge_jobs
  FOR EACH ROW EXECUTE FUNCTION trust.update_updated_at_column();
