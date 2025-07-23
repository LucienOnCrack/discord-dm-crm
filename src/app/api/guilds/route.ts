import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '../../../lib/supabase';

// Discord API interfaces
interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  owner_id: string;
  permissions: string;
  features: string[];
  approximate_member_count?: number;
}

interface GuildWithDetails {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  owner_info: {
    id: string;
    username: string;
    global_name?: string;
    discriminator: string;
    avatar: string | null;
  } | null;
  highest_role_members: Array<{
    id: string;
    username: string;
    global_name?: string;
    discriminator: string;
    avatar: string | null;
    nick?: string;
  }>;
  highest_role_name: string;
  member_count: number;
  total_members: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const forceRefresh = searchParams.get('force') === 'true';

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing required parameter: accountId' },
        { status: 400 }
      );
    }

    // Basic security: Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID format' },
        { status: 400 }
      );
    }

    console.log('🔄 Fetching guilds for account:', accountId, forceRefresh ? '(force refresh)' : '');

    const supabase = createServiceRoleClient();

    // Step 1: Get account token
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('token, user_id, username')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

         // Step 2: Check cache (if not force refresh)
     if (!forceRefresh) {
       console.log('📋 Checking cache...');
       
       const currentTime = new Date().toISOString();
       console.log(`🕒 Current time: ${currentTime}`);
       
       const { data: cachedGuilds, error: cacheError } = await supabase
         .from('guild_cache')
         .select(`
           *,
           guild_members_cache (
             member_id,
             member_username,
             member_global_name,
             member_discriminator,
             member_avatar,
             member_nick
           )
         `)
                           .eq('account_id', accountId);
        
        console.log(`🔍 Cache query result: ${cachedGuilds?.length || 0} guilds, error: ${cacheError?.message || 'none'}`);
        
        // Filter valid (non-expired) cache entries in memory
        const validCachedGuilds = cachedGuilds?.filter(guild => {
          const expiresAt = new Date(guild.expires_at);
          const now = new Date();
          const isValid = expiresAt > now;
          console.log(`📅 ${guild.guild_name}: expires ${guild.expires_at}, valid: ${isValid}`);
          return isValid;
        }) || [];

       if (validCachedGuilds.length > 0) {
                 console.log(`✅ Using cached data: ${validCachedGuilds.length} guilds`);
         
         const guildDetails: GuildWithDetails[] = validCachedGuilds.map(cached => ({
          id: cached.guild_id,
          name: cached.guild_name,
          icon: cached.guild_icon,
          owner_id: cached.owner_id,
          owner_info: cached.owner_username ? {
            id: cached.owner_id,
            username: cached.owner_username,
            global_name: cached.owner_global_name,
            discriminator: cached.owner_discriminator || '0',
            avatar: cached.owner_avatar,
          } : null,
          highest_role_members: (cached.guild_members_cache || []).map((member: {
            member_id: string;
            member_username: string;
            member_global_name: string | null;
            member_discriminator: string;
            member_avatar: string | null;
            member_nick: string | null;
          }) => ({
            id: member.member_id,
            username: member.member_username,
            global_name: member.member_global_name,
            discriminator: member.member_discriminator,
            avatar: member.member_avatar,
            nick: member.member_nick,
          })),
          highest_role_name: cached.highest_role_name,
          member_count: cached.member_count,
          total_members: cached.total_members || 0,
        }));

        return NextResponse.json({
          guilds: guildDetails,
          total_guilds: guildDetails.length,
          processed_guilds: guildDetails.length,
          from_cache: true,
                     cached_at: validCachedGuilds[0]?.cached_at,
        });
      }

      // No valid cache found
      console.log('❌ No valid cache found');
      return NextResponse.json({
        guilds: [],
        total_guilds: 0,
        processed_guilds: 0,
        from_cache: false,
        message: 'No cached data available. Click refresh to fetch from Discord.',
      });
    }

    // Step 3: Fetch from Discord API (force refresh)
    console.log('🌐 Fetching from Discord API...');
    
    const discordResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        'Authorization': account.token,
        'User-Agent': 'DiscordBot (https://discord.gg, 1.0)',
      },
    });

    if (!discordResponse.ok) {
      const errorData = await discordResponse.json().catch(() => ({}));
      console.error('Discord API Error:', discordResponse.status, errorData);
      
      if (discordResponse.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited by Discord. Please try again later.' },
          { status: 429 }
        );
      }
      
      throw new Error(`Discord API error: ${discordResponse.status}`);
    }

    const guilds: DiscordGuild[] = await discordResponse.json();
    console.log(`📊 Found ${guilds.length} guilds for user ${account.username}`);

    // Step 4: Process guilds and build response
    const guildDetails: GuildWithDetails[] = [];
    const maxGuilds = 10; // Rate limit protection

    for (const guild of guilds.slice(0, maxGuilds)) {
      try {
        console.log(`🔍 Processing guild: ${guild.name}`);

        let memberCount = 0;
        let ownerInfo: {
          id: string;
          username: string;
          global_name?: string;
          discriminator: string;
          avatar: string | null;
        } | null = null;

        // Fetch full guild details to get member count AND owner_id
        let guildOwnerId = null;
        try {
          const guildDetailResponse = await fetch(`https://discord.com/api/v10/guilds/${guild.id}?with_counts=true`, {
            headers: {
              'Authorization': account.token,
              'User-Agent': 'DiscordBot (https://discord.gg, 1.0)',
            },
          });

          if (guildDetailResponse.ok) {
            const guildDetail = await guildDetailResponse.json();
            memberCount = guildDetail.approximate_member_count || guildDetail.member_count || 0;
            guildOwnerId = guildDetail.owner_id;
            console.log(`👥 ${guild.name}: ${memberCount} members, owner: ${guildOwnerId}`);
          } else {
            console.warn(`⚠️ Could not fetch guild details for ${guild.name}: ${guildDetailResponse.status}`);
            memberCount = guild.approximate_member_count || 0;
          }
        } catch (error) {
          console.warn(`⚠️ Error fetching guild details for ${guild.name}:`, error);
          memberCount = guild.approximate_member_count || 0;
        }

                // Try to get owner info from guild members (single request)
        if (guildOwnerId) {
          try {
            const membersResponse = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/members/${guildOwnerId}`, {
              headers: {
                'Authorization': account.token,
                'User-Agent': 'DiscordBot (https://discord.gg, 1.0)',
              },
            });

            if (membersResponse.ok) {
              const memberData = await membersResponse.json();
              const userData = memberData.user;
              ownerInfo = {
                id: userData.id,
                username: userData.username,
                global_name: userData.global_name,
                discriminator: userData.discriminator || '0',
                avatar: userData.avatar ? 
                  `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
              };
              console.log(`👑 ${guild.name} owned by: ${ownerInfo.username}`);
            } else {
              console.warn(`⚠️ Could not fetch owner member for ${guild.name}: ${membersResponse.status}`);
              // Fallback: try direct user API (might not work with user tokens)
              try {
                const ownerResponse = await fetch(`https://discord.com/api/v10/users/${guildOwnerId}`, {
                  headers: {
                    'Authorization': account.token,
                    'User-Agent': 'DiscordBot (https://discord.gg, 1.0)',
                  },
                });
                
                if (ownerResponse.ok) {
                  const ownerData = await ownerResponse.json();
                  ownerInfo = {
                    id: ownerData.id,
                    username: ownerData.username,
                    global_name: ownerData.global_name,
                    discriminator: ownerData.discriminator || '0',
                    avatar: ownerData.avatar ? 
                      `https://cdn.discordapp.com/avatars/${ownerData.id}/${ownerData.avatar}.png` : null,
                  };
                  console.log(`👑 ${guild.name} owned by: ${ownerInfo.username} (fallback)`);
                }
              } catch (fallbackError) {
                console.warn(`⚠️ Owner fallback failed for ${guild.name}:`, fallbackError);
              }
            }
          } catch (error) {
            console.warn(`⚠️ Error fetching owner for ${guild.name}:`, error);
          }
        }

        guildDetails.push({
          id: guild.id,
          name: guild.name,
          icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
          owner_id: guildOwnerId || 'unknown',
          owner_info: ownerInfo,
          highest_role_members: [], // Skip member lookup to avoid rate limits
          highest_role_name: 'Member',
          member_count: 0,
          total_members: memberCount,
        });

        // Add delay to avoid rate limits (2 API calls per guild)
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`❌ Error processing guild ${guild.name}:`, error);
        continue;
      }
    }

    console.log(`✅ Successfully processed ${guildDetails.length} guilds`);

              // Step 5: Cache the results (MUST complete before response)
     if (guildDetails.length > 0) {
       try {
         console.log(`💾 Caching ${guildDetails.length} guild results...`);
         
         // Clear old cache
         const { error: deleteError } = await supabase
           .from('guild_cache')
           .delete()
           .eq('account_id', accountId);
         
         if (deleteError) {
           console.error('❌ Error clearing old cache:', deleteError);
         } else {
           console.log('🗑️ Cleared old cache entries');
         }

         // Insert new cache (24 hour expiration)
         const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
         console.log(`⏰ Cache expires at: ${expiresAt}`);
         
         // Insert all guilds in one batch
         const cacheInserts = guildDetails.map(guild => ({
           account_id: accountId,
           guild_id: guild.id,
           guild_name: guild.name,
           guild_icon: guild.icon,
           owner_id: guild.owner_id || '', // Ensure not null
           owner_username: guild.owner_info?.username || null,
           owner_global_name: guild.owner_info?.global_name || null,
           owner_discriminator: guild.owner_info?.discriminator || null,
           owner_avatar: guild.owner_info?.avatar || null,
           highest_role_name: guild.highest_role_name,
           member_count: guild.member_count,
           total_members: guild.total_members,
           expires_at: expiresAt,
         }));
         
         const { error: batchInsertError } = await supabase
           .from('guild_cache')
           .insert(cacheInserts);
         
         if (batchInsertError) {
           console.error('❌ Batch cache insertion error:', batchInsertError);
         } else {
           console.log(`✅ Successfully cached ${cacheInserts.length} guilds`);
         }
         
       } catch (cacheError) {
         console.error('❌ Cache operation failed:', cacheError);
       }
     }

    return NextResponse.json({
      guilds: guildDetails,
      total_guilds: guilds.length,
      processed_guilds: guildDetails.length,
      rate_limited: guilds.length > maxGuilds,
      from_cache: false,
    });

  } catch (error) {
    console.error('❌ API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 