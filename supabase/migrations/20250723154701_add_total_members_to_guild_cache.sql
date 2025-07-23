-- Add total_members column to guild_cache table
ALTER TABLE guild_cache ADD COLUMN total_members INTEGER DEFAULT 0;
