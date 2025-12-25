-- Migration: 019 - Wallet Profiles and Vault Credentials
-- Create wallet_profiles table for unified wallet-scoped personalization
-- Create vault_credentials table for encrypted OAuth tokens and API keys

-- Wallet Profiles table
CREATE TABLE IF NOT EXISTS wallet_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet VARCHAR(42) NOT NULL UNIQUE,
    display_name VARCHAR(64),
    avatar_cid VARCHAR(128),
    face_preset VARCHAR(32) DEFAULT 'line',
    interface_preference TEXT DEFAULT 'canvas' CHECK (interface_preference IN ('canvas', 'chat')),
    voice_style TEXT DEFAULT 'default' CHECK (voice_style IN ('default', 'calm', 'energetic', 'professional', 'friendly')),
    voice_gender TEXT DEFAULT 'neutral' CHECK (voice_gender IN ('neutral', 'masculine', 'feminine')),
    voice_speed INTEGER DEFAULT 100,
    theme_mode VARCHAR(16) DEFAULT 'dark',
    primary_color VARCHAR(32) DEFAULT 'purple',
    pinned_manifests JSONB DEFAULT '[]'::jsonb,
    session_memory_enabled BOOLEAN DEFAULT true,
    remember_pinned_apps BOOLEAN DEFAULT true,
    remember_queries BOOLEAN DEFAULT false,
    remember_flow_history BOOLEAN DEFAULT true,
    onboarding_completed_at TIMESTAMP,
    onboarding_path VARCHAR(16),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vault Credentials table
CREATE TABLE IF NOT EXISTS vault_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_addr VARCHAR(128) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    scope VARCHAR(128) NOT NULL,
    encrypted_blob TEXT NOT NULL,
    nonce TEXT NOT NULL,
    salt TEXT NOT NULL,
    key_type TEXT DEFAULT 'api' CHECK (key_type IN ('oauth', 'api', 'developer')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (wallet_addr, provider, scope)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_profiles_wallet ON wallet_profiles(wallet);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_wallet ON vault_credentials(wallet_addr);
CREATE INDEX IF NOT EXISTS idx_vault_credentials_provider ON vault_credentials(provider);

-- Comment on tables
COMMENT ON TABLE wallet_profiles IS 'Unified wallet-scoped personalization settings for Atlas users';
COMMENT ON TABLE vault_credentials IS 'Encrypted OAuth tokens and API keys with per-wallet encryption';
