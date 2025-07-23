-- Add discord_message_id column to messages table
ALTER TABLE messages ADD COLUMN discord_message_id TEXT UNIQUE; 