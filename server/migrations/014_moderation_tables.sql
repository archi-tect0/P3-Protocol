-- Platform Moderation Tables
-- Adds database-backed role management and moderation audit trails

-- Moderator Roles - persistent role assignments for Hub governance
CREATE TABLE IF NOT EXISTS moderator_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'reviewer' CHECK (role IN ('superuser', 'admin', 'moderator', 'reviewer')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  permissions JSONB,
  assigned_by VARCHAR(42) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Moderation Actions - audit trail for all moderation decisions
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(30) NOT NULL CHECK (action_type IN (
    'hide_app', 'show_app', 'delete_review', 'dismiss_report',
    'ban_user', 'unban_user', 'approve_widget', 'reject_widget',
    'change_category', 'assign_role', 'revoke_role', 'suspend_role'
  )),
  moderator_wallet VARCHAR(42) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  reason TEXT,
  metadata JSONB,
  anchor_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Platform Reports - user-submitted reports for moderation review
CREATE TABLE IF NOT EXISTS platform_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('app', 'review', 'user', 'content', 'widget')),
  target_id VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  reporter_wallet VARCHAR(42) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  assigned_to VARCHAR(42),
  resolution TEXT,
  resolved_by VARCHAR(42),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Banned Wallets - permanently or temporarily banned addresses
CREATE TABLE IF NOT EXISTS banned_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  ban_type VARCHAR(20) NOT NULL DEFAULT 'permanent' CHECK (ban_type IN ('permanent', 'temporary')),
  reason TEXT,
  banned_by VARCHAR(42) NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_moderator_roles_wallet ON moderator_roles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_moderator_roles_status ON moderator_roles(status);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator ON moderation_actions(moderator_wallet);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created ON moderation_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_platform_reports_status ON platform_reports(status);
CREATE INDEX IF NOT EXISTS idx_platform_reports_assigned ON platform_reports(assigned_to);
CREATE INDEX IF NOT EXISTS idx_banned_wallets_address ON banned_wallets(wallet_address);
