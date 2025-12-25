-- Production Hardening Tables
-- Adds tables for payments, escrow, analytics, policy, tenancy, and audit

-- Micro Payments Table
CREATE TABLE IF NOT EXISTS micro_payments (
  id SERIAL PRIMARY KEY,
  from_wallet_id VARCHAR(128) NOT NULL,
  to_wallet_id VARCHAR(128) NOT NULL,
  amount_wei VARCHAR(64) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  memo VARCHAR(256),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_micro_payments_from ON micro_payments(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_micro_payments_to ON micro_payments(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_micro_payments_created ON micro_payments(created_at);

-- Escrows Table
CREATE TABLE IF NOT EXISTS escrows (
  id SERIAL PRIMARY KEY,
  buyer VARCHAR(128) NOT NULL,
  seller VARCHAR(128) NOT NULL,
  amount_wei VARCHAR(64) NOT NULL,
  terms VARCHAR(512) NOT NULL,
  state VARCHAR(32) NOT NULL DEFAULT 'locked',
  recipient VARCHAR(16),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrows_buyer ON escrows(buyer);
CREATE INDEX IF NOT EXISTS idx_escrows_seller ON escrows(seller);
CREATE INDEX IF NOT EXISTS idx_escrows_state ON escrows(state);

-- Anomalies Table (AI Fraud Detection)
CREATE TABLE IF NOT EXISTS anomalies (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  score NUMERIC(4, 3) NOT NULL,
  features JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_tenant ON anomalies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_score ON anomalies(score);
CREATE INDEX IF NOT EXISTS idx_anomalies_created ON anomalies(created_at);

-- Event Bus Table (Pub/Sub)
CREATE TABLE IF NOT EXISTS event_bus (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  publisher VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_bus_topic ON event_bus(topic);
CREATE INDEX IF NOT EXISTS idx_event_bus_publisher ON event_bus(publisher);
CREATE INDEX IF NOT EXISTS idx_event_bus_created ON event_bus(created_at);
CREATE INDEX IF NOT EXISTS idx_event_bus_expires ON event_bus(expires_at);

-- Tenancy Zones Table (Multi-Cloud)
CREATE TABLE IF NOT EXISTS tenancy_zones (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL UNIQUE,
  provider VARCHAR(16) NOT NULL,
  region VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenancy_zones_tenant ON tenancy_zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_zones_provider ON tenancy_zones(provider);

-- Audit Proofs Table (ZK-Ready)
CREATE TABLE IF NOT EXISTS audit_proofs (
  id SERIAL PRIMARY KEY,
  dataset_id VARCHAR(64) NOT NULL,
  selector VARCHAR(128) NOT NULL,
  proof JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_proofs_dataset ON audit_proofs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_audit_proofs_created ON audit_proofs(created_at);

-- SLA Metrics Table
CREATE TABLE IF NOT EXISTS sla_metrics (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(64),
  latency_p50 INTEGER NOT NULL,
  latency_p95 INTEGER NOT NULL,
  uptime_pct NUMERIC(5, 2) NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sla_metrics_endpoint ON sla_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_tenant ON sla_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_period ON sla_metrics(period_start, period_end);

-- Subscriptions Table (Billing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  tier VARCHAR(32) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  blocked_endpoints JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);

-- Protocol State Table (Guardian)
CREATE TABLE IF NOT EXISTS protocol_state (
  id SERIAL PRIMARY KEY,
  paused BOOLEAN DEFAULT FALSE,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP
);

-- Insert initial protocol state if not exists
INSERT INTO protocol_state (paused) 
SELECT FALSE 
WHERE NOT EXISTS (SELECT 1 FROM protocol_state);
