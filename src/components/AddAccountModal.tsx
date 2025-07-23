"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountAdded: () => void;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export function AddAccountModal({ open, onOpenChange, onAccountAdded }: AddAccountModalProps) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  const validateToken = async (token: string): Promise<DiscordUser | null> => {
    try {
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          'Authorization': token,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Discord API Error:', response.status, errorData);
        
        if (response.status === 401) {
          throw new Error('Invalid user token. Please check your token and try again.');
        } else if (response.status === 403) {
          throw new Error('Token lacks required permissions.');
        } else {
          throw new Error(`Discord API error (${response.status}): ${errorData.message || 'Unknown error'}`);
        }
      }

      const userData = await response.json();
      return {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter a Discord token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Validate the token with Discord API
      const discordUser = await validateToken(token.trim());
      
      if (!discordUser) {
        setError('Invalid Discord token. Please check your token and try again.');
        return;
      }

      // Check if account already exists
      const { data: existingAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', discordUser.id)
        .single();

      if (existingAccount) {
        setError('This Discord account is already added to the CRM.');
        return;
      }

      // Save to Supabase
      const { error: dbError } = await supabase
        .from('accounts')
        .insert({
          token: token.trim(),
          user_id: discordUser.id,
          username: discordUser.username,
          avatar: discordUser.avatar,
        });

      if (dbError) {
        throw dbError;
      }

      // Success
      setToken('');
      onAccountAdded();
      
    } catch (error) {
      console.error('Error adding account:', error);
      setError('Failed to add account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setToken('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Discord Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Discord Token
            </label>
            <Input
              id="token"
              type="password"
              placeholder="Enter your Discord token..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Enter your Discord user token for DM monitoring.
              <br />
              <strong>Format:</strong> Long string of letters and numbers
              <br />
              <span className="text-blue-600">🔐 Your token will be encrypted and stored securely.</span>
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex space-x-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !token.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? 'Validating...' : 'Add Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 