-- Migration: 012_anchor_outbox.sql
-- Durable outbox pattern for anchor queue crash recovery

CREATE TABLE IF NOT EXISTS anchor_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  app_id VARCHAR(100) NOT NULL,
  digest VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  heartbeat_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS anchor_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  outbox_id UUID REFERENCES anchor_outbox(id),
  tx_hash VARCHAR(100),
  block_number INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted',
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anchor_outbox_status ON anchor_outbox(status);
CREATE INDEX IF NOT EXISTS idx_anchor_outbox_heartbeat ON anchor_outbox(heartbeat_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_anchor_receipts_status ON anchor_receipts(status);
CREATE INDEX IF NOT EXISTS idx_anchor_receipts_idempotency ON anchor_receipts(idempotency_key);
