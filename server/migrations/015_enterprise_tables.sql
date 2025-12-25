-- P3 Enterprise Tables Migration
-- API keys, billing, guardian, audit, alerts, SSO, tenant policies, SLA, privacy

-- API Keys Table - Hashed API keys for licensed API access
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(128) NOT NULL,
  wallet_owner VARCHAR(64) NOT NULL,
  tier_id INTEGER,
  quota_monthly INTEGER NOT NULL DEFAULT 100000,
  tenant_id VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_wallet_owner ON api_keys(wallet_owner);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);

-- API Usage Table - Track API consumption per key
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(128) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  last_hit_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_usage_key_id ON api_usage(key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_period ON api_usage(period_start, period_end);

-- Subscription Tiers Table - Pricing and feature tiers
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  monthly_price DECIMAL(10, 2) NOT NULL,
  features_json JSONB,
  quota_monthly INTEGER NOT NULL,
  overage_price_per_unit DECIMAL(10, 6)
);

-- Billing Accounts Table - Stripe integration for tenant billing
CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  stripe_customer_id VARCHAR(64),
  active_payment_method VARCHAR(64),
  delinquent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_tenant_id ON billing_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_stripe_customer ON billing_accounts(stripe_customer_id);

-- Protocol State Table - Global protocol pause/unpause state (guardian)
CREATE TABLE IF NOT EXISTS protocol_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paused BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  actor_wallet VARCHAR(42),
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Audit Anchor Batches Table - Merkle tree-based audit log anchoring
CREATE TABLE IF NOT EXISTS audit_anchor_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_root_hash VARCHAR(66) NOT NULL,
  count INTEGER NOT NULL,
  anchored_tx_hash VARCHAR(66),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_anchor_batches_status ON audit_anchor_batches(status);
CREATE INDEX IF NOT EXISTS idx_audit_anchor_batches_period ON audit_anchor_batches(period_start, period_end);

-- Alert Channels Table - Multi-channel alert delivery endpoints
CREATE TABLE IF NOT EXISTS alert_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  type VARCHAR(16) NOT NULL,
  endpoint VARCHAR(256) NOT NULL,
  secret VARCHAR(256),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alert_channels_tenant_id ON alert_channels(tenant_id);

-- Alert Rules Table - Configurable alert thresholds and windows
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  threshold INTEGER NOT NULL,
  window_minutes INTEGER NOT NULL DEFAULT 15,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant_id ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_event_type ON alert_rules(event_type);

-- SSO Providers Table - Enterprise SAML/OIDC configuration
CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  type VARCHAR(16) NOT NULL,
  issuer VARCHAR(256) NOT NULL,
  client_id VARCHAR(256) NOT NULL,
  client_secret VARCHAR(256),
  callback_url VARCHAR(256),
  metadata_url VARCHAR(256),
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_sso_providers_tenant_id ON sso_providers(tenant_id);

-- SSO Identities Table - User-wallet mappings from SSO
CREATE TABLE IF NOT EXISTS sso_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  subject VARCHAR(256) NOT NULL,
  wallet VARCHAR(64) NOT NULL,
  roles JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sso_identities_tenant_id ON sso_identities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sso_identities_subject ON sso_identities(subject);
CREATE INDEX IF NOT EXISTS idx_sso_identities_wallet ON sso_identities(wallet);

-- Tenant Policies Table - Sandbox and feature flags per tenant
CREATE TABLE IF NOT EXISTS tenant_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL UNIQUE,
  sandbox BOOLEAN NOT NULL DEFAULT false,
  sandbox_chain VARCHAR(32),
  features_json JSONB
);

CREATE INDEX IF NOT EXISTS idx_tenant_policies_tenant_id ON tenant_policies(tenant_id);

-- SLA Metrics Table - Service level agreement tracking
CREATE TABLE IF NOT EXISTS sla_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  endpoint VARCHAR(128) NOT NULL,
  latency_ms_p50 INTEGER NOT NULL DEFAULT 0,
  latency_ms_p95 INTEGER NOT NULL DEFAULT 0,
  uptime_pct DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sla_metrics_tenant_id ON sla_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_period ON sla_metrics(period_start, period_end);

-- Privacy Requests Table - GDPR/CCPA data subject requests
CREATE TABLE IF NOT EXISTS privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  requester_wallet_or_email VARCHAR(128) NOT NULL,
  type VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'received',
  scope_json JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_tenant_id ON privacy_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status ON privacy_requests(status);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_type ON privacy_requests(type);

-- Insert default subscription tiers
INSERT INTO subscription_tiers (name, monthly_price, quota_monthly, overage_price_per_unit, features_json)
VALUES 
  ('Free', 0.00, 1000, NULL, '{"apiAccess": true, "support": "community"}'::jsonb),
  ('Starter', 49.00, 100000, 0.000500, '{"apiAccess": true, "support": "email", "sla": "99.5%"}'::jsonb),
  ('Pro', 199.00, 500000, 0.000400, '{"apiAccess": true, "support": "priority", "sla": "99.9%", "sso": true}'::jsonb),
  ('Enterprise', 999.00, 5000000, 0.000300, '{"apiAccess": true, "support": "dedicated", "sla": "99.99%", "sso": true, "customAlerts": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- Insert initial protocol state (not paused)
INSERT INTO protocol_state (paused, reason, actor_wallet)
VALUES (false, 'Initial state - protocol operational', NULL)
ON CONFLICT DO NOTHING;
