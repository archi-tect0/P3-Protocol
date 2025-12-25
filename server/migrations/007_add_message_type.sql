-- Migration 007: Add message type support for voice/video messages
-- Description: Adds messageType column to messages table to differentiate text, voice, and video messages

-- Add messageType column to messages table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type') THEN
    ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text';
  END IF;
END $$;

-- Create index for filtering by message type (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
