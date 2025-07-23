"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Crown, Filter, Server } from 'lucide-react';
import { Guild, GuildsResponse } from '@/types/guild';
import { Account } from '@/lib/supabase';

interface GuildDashboardProps {
  account: Account;
}

export function GuildDashboard({ account }: GuildDashboardProps) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'owner'>('name');
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{age: string, fromCache: boolean}>({age: '', fromCache: false});

  useEffect(() => {
    // Load from database cache only (no API calls on mount)
    loadFromDatabaseCache();
  }, [account.id]);

  const loadFromDatabaseCache = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📋 Loading guilds from database cache...');
      const response = await fetch(`/api/guilds?accountId=${account.id}`);
      
      if (response.ok) {
        const data: GuildsResponse & {from_cache?: boolean, cached_at?: string} = await response.json();
        
        if (data.from_cache) {
          setGuilds(data.guilds);
          setCacheInfo({
            age: formatCacheAge(data.cached_at || ''),
            fromCache: true
          });
          console.log(`✅ Loaded ${data.guilds.length} guilds from cache`);
        } else {
          // No cache available, show empty state
          setGuilds([]);
          setCacheInfo({age: '', fromCache: false});
        }
      }
    } catch (err) {
      console.error('Error loading from cache:', err);
      setGuilds([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCacheAge = (cachedAt: string): string => {
    const cacheTime = new Date(cachedAt);
    const now = new Date();
    const ageMs = now.getTime() - cacheTime.getTime();
    const minutes = Math.floor(ageMs / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const fetchGuilds = async (force = false) => {
    try {
      // Prevent rapid successive calls for force refresh (minimum 10 seconds between requests)
      const now = Date.now();
      if (force && lastFetch && (now - lastFetch) < 10000) {
        setError('Please wait 10 seconds between force refreshes to avoid rate limiting');
        return;
      }

      setLoading(true);
      setError(null);
      
      const url = `/api/guilds?accountId=${account.id}${force ? '&force=true' : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error('Rate limited. Please wait a moment and try again.');
        }
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data: GuildsResponse & {from_cache?: boolean, cached_at?: string} = await response.json();
      setGuilds(data.guilds);
      setLastFetch(now);
      
      // Update cache info
      if (data.from_cache && data.cached_at) {
        setCacheInfo({
          age: formatCacheAge(data.cached_at),
          fromCache: true
        });
      } else {
        setCacheInfo({
          age: 'Just fetched',
          fromCache: false
        });
      }
      
      // Show warning if rate limited
      if (data.rate_limited) {
        setError(`Showing ${data.processed_guilds} of ${data.total_guilds} guilds due to rate limiting. Refresh to see more.`);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch guilds');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedGuilds = guilds
    .filter(guild => 
      guild.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (guild.owner_info?.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      guild.highest_role_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'members':
          return b.member_count - a.member_count;
        case 'owner':
          return (a.owner_info?.username || '').localeCompare(b.owner_info?.username || '');
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const formatUsername = (member: { username: string; global_name?: string; discriminator: string }) => {
    if (member.global_name) {
      return member.global_name;
    }
    return member.discriminator === '0' ? member.username : `${member.username}#${member.discriminator}`;
  };

  const canRefresh = !lastFetch || (Date.now() - lastFetch) >= 30000;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Discord Servers</h2>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && guilds.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Discord Servers</h2>
          <Button 
            onClick={() => fetchGuilds(true)} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Loading...' : 'Load Servers'}
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={() => fetchGuilds(true)} disabled={loading}>
                {loading ? 'Loading...' : 'Retry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Discord Servers</h2>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <Badge variant="secondary">{guilds.length} servers</Badge>
            {cacheInfo.age && (
              <span className="text-xs text-muted-foreground mt-1">
                {cacheInfo.fromCache ? '📋 Cached' : '🔄 Fresh'} • {cacheInfo.age}
              </span>
            )}
          </div>
          <Button 
            onClick={() => fetchGuilds(true)} 
            disabled={loading || !canRefresh}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Show initial load prompt */}
      {guilds.length === 0 && !loading && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex flex-col items-center space-y-4 text-muted-foreground">
                <Server className="h-16 w-16" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Discord Servers
                  </h3>
                  <p className="text-sm mb-4">
                    Your Discord servers will load automatically from the database cache.<br/>
                    Data is cached for 1 hour to reduce API calls.
                  </p>
                  <Button onClick={() => fetchGuilds(true)} disabled={loading}>
                    <Search className="h-4 w-4 mr-2" />
                    {loading ? 'Loading...' : 'Fetch Servers'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show error message at top if there are guilds but also an error */}
      {error && guilds.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-yellow-600 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search servers, owners, or roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(value: 'name' | 'members' | 'owner') => setSortBy(value)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Server Name</SelectItem>
            <SelectItem value="members">Member Count</SelectItem>
            <SelectItem value="owner">Owner Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Guild Grid - Only show if we have guilds */}
      {guilds.length > 0 && (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedGuilds.map((guild) => (
          <Card key={guild.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedGuild(guild)}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={guild.icon || undefined} alt={guild.name} />
                  <AvatarFallback>{guild.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                                 <div className="flex-1 min-w-0">
                   <CardTitle className="text-lg truncate">{guild.name}</CardTitle>
                   <div className="flex items-center text-sm text-muted-foreground">
                     <Users className="h-4 w-4 mr-1" />
                     {guild.total_members.toLocaleString()} members
                   </div>
                 </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Server Owner */}
              {guild.owner_info && (
                <div className="space-y-2">
                  <div className="flex items-center text-sm font-medium">
                    <Crown className="h-4 w-4 mr-2 text-yellow-500" />
                    Server Owner
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={guild.owner_info.avatar || undefined} />
                      <AvatarFallback>{guild.owner_info.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{formatUsername(guild.owner_info)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">ID: {guild.owner_info.id}</div>
                </div>
              )}


            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {filteredAndSortedGuilds.length === 0 && !loading && guilds.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              {searchQuery ? 'No servers match your search criteria.' : 'No servers found.'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Guild Modal */}
      {selectedGuild && (
        <GuildDetailModal 
          guild={selectedGuild} 
          onClose={() => setSelectedGuild(null)} 
        />
      )}
    </div>
  );
}

// Guild Detail Modal Component
interface GuildDetailModalProps {
  guild: Guild;
  onClose: () => void;
}

function GuildDetailModal({ guild, onClose }: GuildDetailModalProps) {
  const formatUsername = (member: { username: string; global_name?: string; discriminator: string }) => {
    if (member.global_name) {
      return member.global_name;
    }
    return member.discriminator === '0' ? member.username : `${member.username}#${member.discriminator}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-16 w-16">
                <AvatarImage src={guild.icon || undefined} alt={guild.name} />
                <AvatarFallback>{guild.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
                             <div>
                 <CardTitle className="text-xl">{guild.name}</CardTitle>
                 <div className="flex items-center text-sm text-muted-foreground">
                   <Users className="h-4 w-4 mr-1" />
                   {guild.total_members.toLocaleString()} members
                 </div>
               </div>
            </div>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-6">
              {/* Server Owner Section */}
              {guild.owner_info && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <Crown className="h-5 w-5 mr-2 text-yellow-500" />
                    Server Owner
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={guild.owner_info.avatar || undefined} />
                        <AvatarFallback>{guild.owner_info.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{formatUsername(guild.owner_info)}</div>
                        <div className="text-sm text-muted-foreground">@{guild.owner_info.username}</div>
                        <div className="text-xs text-muted-foreground">ID: {guild.owner_info.id}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}


            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
} 