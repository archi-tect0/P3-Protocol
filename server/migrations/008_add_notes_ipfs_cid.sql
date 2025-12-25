-- Add IPFS CID field to notes table for IPFS export/import functionality
ALTER TABLE notes ADD COLUMN IF NOT EXISTS ipfs_cid TEXT;

-- Add anchor chain ID field to notes table
ALTER TABLE notes ADD COLUMN IF NOT EXISTS anchor_chain_id INTEGER;
