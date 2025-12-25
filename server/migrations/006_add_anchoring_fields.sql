-- Add anchoring fields to messages and notes tables
-- Migration 006: Anchoring Support
-- Date: 2025-11-16

-- Add anchor columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS anchor_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS anchor_status TEXT NOT NULL DEFAULT 'none' CHECK (anchor_status IN ('pending', 'confirmed', 'failed', 'none')),
ADD COLUMN IF NOT EXISTS anchor_timestamp TIMESTAMP;

-- Add receipt reference and anchor columns to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts(id),
ADD COLUMN IF NOT EXISTS anchor_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS anchor_status TEXT NOT NULL DEFAULT 'none' CHECK (anchor_status IN ('pending', 'confirmed', 'failed', 'none')),
ADD COLUMN IF NOT EXISTS anchor_timestamp TIMESTAMP;

-- Create indexes for anchor queries
CREATE INDEX IF NOT EXISTS idx_messages_anchor_status ON messages(anchor_status);
CREATE INDEX IF NOT EXISTS idx_messages_anchor_tx_hash ON messages(anchor_tx_hash);
CREATE INDEX IF NOT EXISTS idx_notes_anchor_status ON notes(anchor_status);
CREATE INDEX IF NOT EXISTS idx_notes_anchor_tx_hash ON notes(anchor_tx_hash);
CREATE INDEX IF NOT EXISTS idx_notes_receipt_id ON notes(receipt_id);

-- Verify changes
SELECT 'Migration 006 completed successfully' AS status;
