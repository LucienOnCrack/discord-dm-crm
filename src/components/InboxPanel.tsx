"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, MessageCircle, Users, Server, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AddAccountModal } from '@/components/AddAccountModal';
import { createClient } from '@/lib/supabase';
import type { Account } from '@/lib/supabase';

interface InboxPanelProps {
  onAccountSelect: (account: Account) => void;
  onUserSelect: (userId: string) => void;
  selectedAccount: Account | null;
  selectedUserId: string | null;
  activeView: 'messages' | 'guilds';
  onViewChange: (view: 'messages' | 'guilds') => void;
}

interface Conversation {
  discord_user_id: string;
  username: string;
  avatar: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  direction: 'sent' | 'received';
}

export function InboxPanel({ 
  onAccountSelect, 
  onUserSelect, 
  selectedAccount, 
  selectedUserId,
  activeView,
  onViewChange 
}: InboxPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount?.id && activeView === 'messages') {
      loadConversations();
    }
  }, [selectedAccount?.id, activeView]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    if (!selectedAccount?.id) return;

    try {
      setConversationsLoading(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select(`
          discord_user_id,
          username,
          avatar,
          content,
          timestamp,
          direction
        `)
        .eq('account_id', selectedAccount.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Group messages by user and get the latest message for each
      const conversationMap = new Map<string, Conversation>();
      
      data?.forEach((message) => {
        const userId = message.discord_user_id;
        
        if (!conversationMap.has(userId)) {
          conversationMap.set(userId, {
            discord_user_id: userId,
            username: message.username,
            avatar: message.avatar,
            last_message: message.content,
            last_message_time: message.timestamp,
            unread_count: 0, // TODO: Implement unread tracking
            direction: message.direction,
          });
        }
      });

      const conversationsList = Array.from(conversationMap.values())
        .sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

      setConversations(conversationsList);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setConversationsLoading(false);
    }
  };

  const handleAccountAdded = () => {
    loadAccounts();
    setShowAddModal(false);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.last_message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-80 border-r border-border flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-semibold mb-4">Discord CRM</h1>
        <Button 
          onClick={() => setShowAddModal(true)}
          className="w-full mb-4"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>

        {/* View Toggle */}
        {selectedAccount && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Button
              variant={activeView === 'messages' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => onViewChange('messages')}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Messages
            </Button>
            <Button
              variant={activeView === 'guilds' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => onViewChange('guilds')}
            >
              <Server className="h-4 w-4 mr-2" />
              Servers
            </Button>
          </div>
        )}
      </div>

      {/* Accounts List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Accounts ({accounts.length})
            </h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 rounded-lg">
                    <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <Card className="p-4 text-center">
                <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                  <Users className="h-8 w-8" />
                  <p className="text-sm">No accounts added yet</p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddModal(true)}
                  >
                    Add your first account
                  </Button>
                </div>
              </Card>
            ) : (
              accounts.map((account) => (
                <Card 
                  key={account.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedAccount?.id === account.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => onAccountSelect(account)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={account.avatar || undefined} />
                        <AvatarFallback>
                          {account.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {account.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {account.user_id}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Conversations List - Only show for messages view */}
          {selectedAccount && activeView === 'messages' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Conversations
                </h2>
                {conversations.length > 0 && (
                  <Badge variant="secondary">{conversations.length}</Badge>
                )}
              </div>

              {/* Search */}
              {conversations.length > 0 && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}

              {conversationsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-3 p-3 rounded-lg">
                      <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                      <div className="space-y-1 flex-1">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length === 0 ? (
                <Card className="p-4 text-center">
                  <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                    <MessageCircle className="h-8 w-8" />
                    <p className="text-sm">
                      {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                    </p>
                    {!searchQuery && (
                      <p className="text-xs">
                        Start messaging to see conversations here
                      </p>
                    )}
                  </div>
                </Card>
              ) : (
                filteredConversations.map((conversation) => (
                  <Card 
                    key={conversation.discord_user_id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedUserId === conversation.discord_user_id ? 'bg-muted' : ''
                    }`}
                    onClick={() => onUserSelect(conversation.discord_user_id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={conversation.avatar || undefined} />
                          <AvatarFallback>
                            {conversation.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate">
                              {conversation.username}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(conversation.last_message_time)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground truncate">
                              {conversation.direction === 'sent' && '→ '}
                              {conversation.last_message}
                            </p>
                            {conversation.unread_count > 0 && (
                              <Badge variant="default" className="ml-2 text-xs">
                                {conversation.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Guild View Indicator */}
          {selectedAccount && activeView === 'guilds' && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Viewing Discord Servers
              </h2>
              <Card className="p-4 text-center">
                <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                  <Server className="h-8 w-8" />
                  <p className="text-sm">
                    Server information is displayed in the main panel
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add Account Modal */}
      <AddAccountModal 
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAccountAdded={handleAccountAdded}
      />
    </div>
  );
} 