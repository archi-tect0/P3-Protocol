-- P3 Protocol Database Schema Migration
-- Version: 002
-- Description: Trust Layer tables for admin dashboard

-- ============================================================================
-- Trust Config Table (Configuration Journal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trust_config_key_version ON trust_config(key, version);
CREATE INDEX IF NOT EXISTS idx_trust_config_key ON trust_config(key);
CREATE INDEX IF NOT EXISTS idx_trust_config_created_by ON trust_config(created_by);
CREATE INDEX IF NOT EXISTS idx_trust_config_created_at ON trust_config(created_at);

-- ============================================================================
-- Trust Rules Table (Smart Rules Engine)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  condition JSONB NOT NULL,
  action JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'testing')),
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_rules_status ON trust_rules(status);
CREATE INDEX IF NOT EXISTS idx_trust_rules_priority ON trust_rules(priority);
CREATE INDEX IF NOT EXISTS idx_trust_rules_created_by ON trust_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_trust_rules_created_at ON trust_rules(created_at);
CREATE INDEX IF NOT EXISTS idx_trust_rules_last_executed_at ON trust_rules(last_executed_at);

-- ============================================================================
-- Trust Plugins Table (Plugin Registry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust_plugins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plugin_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  config JSONB,
  status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
  installed_by UUID NOT NULL REFERENCES users(id),
  installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_plugins_plugin_id ON trust_plugins(plugin_id);
CREATE INDEX IF NOT EXISTS idx_trust_plugins_status ON trust_plugins(status);
CREATE INDEX IF NOT EXISTS idx_trust_plugins_installed_by ON trust_plugins(installed_by);
CREATE INDEX IF NOT EXISTS idx_trust_plugins_installed_at ON trust_plugins(installed_at);

-- ============================================================================
-- Trigger Functions for Updated At Timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trust_config_updated_at ON trust_config;
CREATE TRIGGER update_trust_config_updated_at BEFORE UPDATE ON trust_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trust_rules_updated_at ON trust_rules;
CREATE TRIGGER update_trust_rules_updated_at BEFORE UPDATE ON trust_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trust_plugins_updated_at ON trust_plugins;
CREATE TRIGGER update_trust_plugins_updated_at BEFORE UPDATE ON trust_plugins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
