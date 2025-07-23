"use client";

import React, { useState } from 'react';
import { InboxPanel } from '@/components/InboxPanel';
import { ChatView } from '@/components/ChatView';
import { GuildDashboard } from '@/components/GuildDashboard';
import type { Account } from '@/lib/supabase';

export default function Home() {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'messages' | 'guilds'>('messages');

  const handleAccountSelect = (account: Account) => {
    setSelectedAccount(account);
    setSelectedUserId(null);
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    setActiveView('messages');
  };

  const handleBackToInbox = () => {
    setSelectedUserId(null);
  };

  const handleViewChange = (view: 'messages' | 'guilds') => {
    setActiveView(view);
    setSelectedUserId(null);
  };

  return (
    <div className="flex h-screen">
      <InboxPanel 
        onAccountSelect={handleAccountSelect}
        onUserSelect={handleUserSelect}
        selectedAccount={selectedAccount}
        selectedUserId={selectedUserId}
        activeView={activeView}
        onViewChange={handleViewChange}
      />
      
      <main className="flex-1 overflow-hidden">
        {selectedUserId && selectedAccount ? (
          <ChatView 
            account={selectedAccount}
            userId={selectedUserId}
            onBack={handleBackToInbox}
          />
        ) : selectedAccount && activeView === 'guilds' ? (
          <div className="h-full p-6 overflow-auto">
            <GuildDashboard account={selectedAccount} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <h2 className="text-lg font-semibold mb-2">Welcome to Discord CRM</h2>
              <p className="mb-4">Select an account to view {activeView === 'messages' ? 'messages' : 'Discord servers'}</p>
              {!selectedAccount && (
                <p className="text-sm">Add a Discord account to get started</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
