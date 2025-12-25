-- Add Kyber post-quantum encryption support to pubkeys table
ALTER TABLE pubkeys 
ADD COLUMN IF NOT EXISTS kyber_pub_b64 TEXT,
ADD COLUMN IF NOT EXISTS kyber_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pubkeys_kyber_enabled ON pubkeys(kyber_enabled) WHERE kyber_enabled = TRUE;
