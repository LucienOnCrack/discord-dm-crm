-- Fix RLS policies for guild cache tables

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations on guild_cache" ON guild_cache;
DROP POLICY IF EXISTS "Allow all operations on guild_members_cache" ON guild_members_cache;

-- Create proper RLS policies that allow service role access
CREATE POLICY "Allow service role full access to guild_cache" ON guild_cache
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role full access to guild_members_cache" ON guild_members_cache
    FOR ALL USING (true) WITH CHECK (true); 