-- DAO Proposals Table for On-Chain Governance
-- This table stores DAO proposals and their state

CREATE TABLE IF NOT EXISTS dao_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id TEXT NOT NULL UNIQUE,
  proposer TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  targets TEXT[] NOT NULL,
  values TEXT[] NOT NULL,
  calldatas TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  votes_for TEXT NOT NULL DEFAULT '0',
  votes_against TEXT NOT NULL DEFAULT '0',
  votes_abstain TEXT NOT NULL DEFAULT '0',
  start_block TEXT,
  end_block TEXT,
  eta TIMESTAMP,
  tx_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_dao_proposals_status ON dao_proposals(status);
CREATE INDEX IF NOT EXISTS idx_dao_proposals_proposer ON dao_proposals(proposer);
CREATE INDEX IF NOT EXISTS idx_dao_proposals_proposal_id ON dao_proposals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_dao_proposals_created_at ON dao_proposals(created_at DESC);

-- Add comment explaining the table
COMMENT ON TABLE dao_proposals IS 'Stores DAO governance proposals with on-chain voting integration';
