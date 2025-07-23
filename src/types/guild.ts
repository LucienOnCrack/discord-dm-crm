export interface GuildMember {
  id: string;
  username: string;
  global_name?: string;
  discriminator: string;
  avatar: string | null;
  nick?: string;
}

export interface GuildOwner {
  id: string;
  username: string;
  global_name?: string;
  discriminator: string;
  avatar: string | null;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  owner_info: GuildOwner | null;
  highest_role_members: GuildMember[];
  highest_role_name: string;
  member_count: number;
  total_members: number;
}

export interface GuildsResponse {
  guilds: Guild[];
  total_guilds: number;
  processed_guilds: number;
  rate_limited?: boolean;
  from_cache?: boolean;
  cached_at?: string;
} 