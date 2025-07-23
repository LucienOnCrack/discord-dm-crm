-- Create guilds cache table
CREATE TABLE guild_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL,
    guild_name TEXT NOT NULL,
    guild_icon TEXT,
    owner_id TEXT NOT NULL,
    owner_username TEXT,
    owner_global_name TEXT,
    owner_discriminator TEXT,
    owner_avatar TEXT,
    highest_role_name TEXT NOT NULL,
    member_count INTEGER DEFAULT 0,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    UNIQUE(account_id, guild_id)
);

-- Create guild members cache table
CREATE TABLE guild_members_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_cache_id UUID NOT NULL REFERENCES guild_cache(id) ON DELETE CASCADE,
    member_id TEXT NOT NULL,
    member_username TEXT NOT NULL,
    member_global_name TEXT,
    member_discriminator TEXT NOT NULL,
    member_avatar TEXT,
    member_nick TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_guild_cache_account_id ON guild_cache(account_id);
CREATE INDEX idx_guild_cache_expires_at ON guild_cache(expires_at);
CREATE INDEX idx_guild_cache_account_guild ON guild_cache(account_id, guild_id);
CREATE INDEX idx_guild_members_cache_guild_id ON guild_members_cache(guild_cache_id);

-- Create function to clean up expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_guild_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM guild_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE guild_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_members_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for guild_cache
CREATE POLICY "Allow service role full access to guild_cache" ON guild_cache
    FOR ALL USING (true) WITH CHECK (true);

-- Create RLS policies for guild_members_cache  
CREATE POLICY "Allow service role full access to guild_members_cache" ON guild_members_cache
    FOR ALL USING (true) WITH CHECK (true);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE guild_cache;
ALTER PUBLICATION supabase_realtime ADD TABLE guild_members_cache;
