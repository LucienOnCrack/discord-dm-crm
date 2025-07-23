"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import type { Account, Message } from '@/lib/supabase';

interface ChatViewProps {
  account: Account;
  userId: string;
  onBack: () => void;
}

export function ChatView({ account, userId, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username: string; avatar: string | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadMessages();
    const unsubscribe = setupRealtimeSubscription();
    
    // Cleanup function to unsubscribe when component unmounts or dependencies change
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [account.id, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('account_id', account.id)
        .eq('discord_user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
      
      // Get user info from the first message
      if (data && data.length > 0) {
        setUserInfo({
          username: data[0].username,
          avatar: data[0].avatar,
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    console.log(`🔔 Setting up real-time subscription for account ${account.id}, user ${userId}`);
    
    const subscription = supabase
      .channel(`messages-${account.id}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `account_id=eq.${account.id}`,
        },
        (payload) => {
          console.log('📨 Real-time message received:', payload);
          const newMessage = payload.new as Message;
          
          // Only add messages for this specific conversation
          if (newMessage.discord_user_id === userId) {
            console.log('✅ Adding message to conversation:', newMessage.content);
            setMessages(prev => {
              // Prevent duplicates by checking if message already exists
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) {
                console.log('⚠️ Message already exists, skipping');
                return prev;
              }
              return [...prev, newMessage];
            });
          } else {
            console.log('⏭️ Message not for this conversation, skipping');
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from real-time messages');
      subscription.unsubscribe();
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    
    try {
      console.log('🚀 Sending message via bot service API...');
      
      // Send message via bot service API
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: account.id,
          userId: userId,
          content: newMessage.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Message sent successfully:', result);

      // Add optimistic update - show message immediately
      const optimisticMessage: Message = {
        id: result.messageId || `temp-${Date.now()}`,
        account_id: account.id,
        discord_user_id: userId,
        username: userInfo?.username || 'You',
        avatar: userInfo?.avatar || null,
        direction: 'sent',
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => {
        // Check if message already exists (from real-time update)
        const exists = prev.some(msg => msg.id === optimisticMessage.id);
        if (exists) return prev;
        return [...prev, optimisticMessage];
      });

      setNewMessage('');
      
      // Success feedback
      if (typeof window !== 'undefined') {
        // Simple success indicator - you could replace with a toast library
        const successMsg = document.createElement('div');
        successMsg.textContent = '✅ Message sent!';
        successMsg.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:12px 20px;border-radius:8px;z-index:1000;font-weight:500;';
        document.body.appendChild(successMsg);
        setTimeout(() => document.body.removeChild(successMsg), 3000);
      }
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Error feedback
      if (typeof window !== 'undefined') {
        const errorMsg = document.createElement('div');
        errorMsg.textContent = `❌ Failed to send: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errorMsg.style.cssText = 'position:fixed;top:20px;right:20px;background:#ef4444;color:white;padding:12px 20px;border-radius:8px;z-index:1000;font-weight:500;max-width:300px;';
        document.body.appendChild(errorMsg);
        setTimeout(() => document.body.removeChild(errorMsg), 5000);
      }
      
      // Don't clear the message if sending failed
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const dateKey = new Date(message.timestamp).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return Object.entries(groups).map(([date, msgs]) => ({
      date,
      messages: msgs,
    }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
            <div className="w-32 h-4 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-3">
                <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarImage src={userInfo?.avatar || undefined} />
            <AvatarFallback>
              {userInfo?.username?.slice(0, 2).toUpperCase() || 'UN'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold">{userInfo?.username || 'Unknown User'}</h1>
            <p className="text-xs text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages in this conversation yet.</p>
            </div>
          ) : (
            groupMessagesByDate(messages).map(({ date, messages: dayMessages }) => (
              <div key={date}>
                <div className="flex justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {formatDate(dayMessages[0].timestamp)}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {dayMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex space-x-3 ${
                        message.direction === 'sent' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
                    >
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarImage 
                          src={message.direction === 'sent' ? account.avatar || undefined : message.avatar || undefined} 
                        />
                        <AvatarFallback>
                          {message.direction === 'sent' 
                            ? account.username.slice(0, 2).toUpperCase()
                            : message.username.slice(0, 2).toUpperCase()
                          }
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex-1 ${message.direction === 'sent' ? 'text-right' : ''}`}>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium">
                            {message.direction === 'sent' ? 'You' : message.username}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        
                        <Card className={`inline-block max-w-[70%] ${
                          message.direction === 'sent' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <CardContent className="p-3">
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${userInfo?.username || 'user'}...`}
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
} 