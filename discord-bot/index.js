require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Discord bot configuration
const discordToken = process.env.DISCORD_TOKEN;

// Store multiple bot clients for different accounts
const botClients = new Map();

class DiscordCRMBot {
  constructor(token, accountId) {
    this.token = token;
    this.accountId = accountId;
    this.client = new Client({
      checkUpdate: false
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.once('ready', async () => {
      console.log(`✅ Selfbot ready! Logged in as ${this.client.user.tag} (Account ID: ${this.accountId})`);
      
      // Extract existing DM conversations
      try {
        await this.fetchExistingDMs();
      } catch (error) {
        console.error('Error fetching existing DMs:', error);
      }
    });

    this.client.on('messageCreate', async (message) => {
      // Only process DM messages
      if (message.channel.type !== 'DM') return;

      // Skip messages from this account
      if (message.author.id === this.client.user.id) return;

      try {
        await this.recordMessage(message);
        console.log(`💬 Recorded DM from ${message.author.username}: ${message.content.substring(0, 50)}...`);
      } catch (error) {
        console.error('Error recording message:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error(`Selfbot error for account ${this.accountId}:`, error);
    });
  }

  async recordMessage(message) {
    const isFromBot = message.author.id === this.client.user.id;
    const otherUser = isFromBot ? message.channel.recipient : message.author;

    const messageData = {
      account_id: this.accountId,
      discord_message_id: message.id,
      discord_user_id: otherUser.id,
      username: otherUser.username,
      avatar: otherUser.avatar ? 
        `https://cdn.discordapp.com/avatars/${otherUser.id}/${otherUser.avatar}.png` : 
        null,
      direction: isFromBot ? 'sent' : 'received',
      content: message.content,
      timestamp: message.createdAt.toISOString()
    };

    console.log(`📝 Recording message: ${messageData.direction} - ${messageData.content.substring(0, 50)}...`);

    const { error } = await supabase
      .from('messages')
      .insert(messageData);

    if (error) {
      throw error;
    }

    console.log('✅ Message recorded successfully');
  }

  async recordSentMessage(messageData, channelId) {
    try {
      // Get channel info to determine recipient
      const channel = this.client.channels.cache.get(channelId);
      if (!channel || channel.type !== 'DM') {
        console.log('⚠️ Channel not found or not a DM channel, skipping record');
        return;
      }

      const recipient = channel.recipient;
      
      const dbMessageData = {
        account_id: this.accountId,
        discord_message_id: messageData.id,
        discord_user_id: recipient.id,
        username: recipient.username,
        avatar: recipient.avatar ? 
          `https://cdn.discordapp.com/avatars/${recipient.id}/${recipient.avatar}.png` : null,
        direction: 'sent',
        content: messageData.content,
        timestamp: messageData.timestamp ? new Date(messageData.timestamp).toISOString() : new Date().toISOString()
      };

      console.log(`📝 Recording sent message to ${recipient.username}: ${messageData.content.substring(0, 50)}...`);

      const { error } = await supabase
        .from('messages')
        .insert(dbMessageData);

      if (error) {
        throw error;
      }

      console.log('✅ Sent message recorded successfully');
    } catch (error) {
      console.error('❌ Error recording sent message:', error);
      throw error;
    }
  }

  async fetchExistingDMs() {
    console.log(`🔍 Fetching existing DM conversations for ${this.client.user.tag}...`);
    
    try {
      // Get all DM channels
      const dmChannels = this.client.channels.cache.filter(channel => channel.type === 'DM');
      console.log(`📬 Found ${dmChannels.size} DM channels`);

      let totalMessages = 0;

      for (const [channelId, channel] of dmChannels) {
        try {
          console.log(`📥 Fetching messages from ${channel.recipient?.username || 'Unknown User'}...`);
          
          // Fetch last 50 messages from this DM channel
          const messages = await channel.messages.fetch({ limit: 50 });
          console.log(`💬 Found ${messages.size} messages in DM with ${channel.recipient?.username}`);

          // Process messages in chronological order (oldest first)
          const sortedMessages = Array.from(messages.values()).reverse();
          
          for (const message of sortedMessages) {
            // Skip empty messages or system messages
            if (!message.content || message.system) continue;

            // Check if message already exists in database
            const { data: existingMessage } = await supabase
              .from('messages')
              .select('id')
              .eq('discord_message_id', message.id)
              .single();

            if (existingMessage) {
              continue; // Skip if already in database
            }

            // Determine direction (sent by this account or received)
            const direction = message.author.id === this.client.user.id ? 'sent' : 'received';

            const messageData = {
              account_id: this.accountId,
              discord_message_id: message.id,
              discord_user_id: channel.recipient.id,
              username: channel.recipient.username,
              avatar: channel.recipient.avatar ? 
                `https://cdn.discordapp.com/avatars/${channel.recipient.id}/${channel.recipient.avatar}.png` : null,
              direction: direction,
              content: message.content,
              timestamp: message.createdAt.toISOString(),
            };

            const { error } = await supabase
              .from('messages')
              .insert(messageData);

            if (error) {
              console.error('Error saving existing message:', error);
            } else {
              totalMessages++;
            }
          }

        } catch (error) {
          console.error(`Error fetching messages from channel ${channelId}:`, error);
        }
      }

      console.log(`🎉 Successfully imported ${totalMessages} existing messages from ${dmChannels.size} DM conversations`);
      
    } catch (error) {
      console.error('Error in fetchExistingDMs:', error);
    }
  }

  async start() {
    try {
      // For selfbots/user tokens, just login directly
      console.log(`👤 Starting selfbot for account ${this.accountId}`);
      await this.client.login(this.token);
      console.log(`🚀 Started selfbot for account ${this.accountId}`);
    } catch (error) {
      console.error(`❌ Failed to start selfbot for account ${this.accountId}:`, error);
      
      // Provide helpful debugging info
      if (error.code === 'TokenInvalid') {
        console.log(`🔍 Debug info:`);
        console.log(`   Token length: ${this.token.length}`);
        console.log(`   Token start: ${this.token.substring(0, 10)}...`);
        console.log(`   Account ID: ${this.accountId}`);
      }
      
      throw error;
    }
  }

  async stop() {
    if (this.client) {
      this.client.destroy();
      console.log(`🛑 Stopped bot for account ${this.accountId}`);
    }
  }

  async sendMessage(channelId, content) {
    try {
      // Generate nonce (19 digit random number)
      const nonce = Array.from({length: 19}, () => Math.floor(Math.random() * 9) + 1).join('');
      
      const payload = {
        mobile_network_type: 'unknown',
        content: String(content),
        nonce: nonce,
        tts: false,
        flags: 0
      };

      const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'content-type': 'application/json',
          'authorization': this.token,
          'origin': 'https://discord.com',
          'referer': 'https://discord.com/channels/@me',
          'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'x-debug-options': 'bugReporterEnabled',
          'x-discord-locale': 'en-US',
          'x-discord-timezone': 'America/New_York'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Discord API error ${response.status}: ${errorData.message || response.statusText}`);
      }

      const messageData = await response.json();
      console.log(`✅ Message sent successfully via HTTP API to channel ${channelId}`);
      console.log('📋 Discord API response:', JSON.stringify(messageData, null, 2));
      
      // Record the sent message to database
      try {
        await this.recordSentMessage(messageData, channelId);
      } catch (recordError) {
        console.error('❌ Error recording sent message:', recordError);
      }
      
      return { 
        success: true, 
        message: 'Message sent successfully',
        messageId: messageData.id,
        content: messageData.content
      };
      
    } catch (error) {
      console.error('❌ Error sending message via HTTP API:', error);
      throw error;
    }
  }
}

class BotManager {
  constructor() {
    this.bots = new Map();
    this.initializeFromDatabase();
  }

  async initializeFromDatabase() {
    try {
      console.log('🔄 Loading accounts from database...');
      
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, token, username');

      if (error) throw error;

      console.log(`📊 Found ${accounts.length} accounts in database`);

      for (const account of accounts) {
        try {
          await this.addBot(account.id, account.token);
          console.log(`✅ Initialized selfbot for ${account.username}`);
        } catch (error) {
          console.error(`❌ Failed to initialize selfbot for ${account.username}:`, error.message);
        }
      }

      console.log(`🎉 Bot manager initialized with ${this.bots.size} active bots`);
    } catch (error) {
      console.error('Error initializing from database:', error);
    }
  }

  async addBot(accountId, token) {
    if (this.bots.has(accountId)) {
      console.log(`⚠️ Bot for account ${accountId} already exists`);
      return;
    }

    const bot = new DiscordCRMBot(token, accountId);
    await bot.start();
    this.bots.set(accountId, bot);
    
    console.log(`➕ Added bot for account ${accountId}`);
  }

  async removeBot(accountId) {
    const bot = this.bots.get(accountId);
    if (bot) {
      await bot.stop();
      this.bots.delete(accountId);
      console.log(`➖ Removed bot for account ${accountId}`);
    }
  }

  async sendMessage(accountId, userId, content) {
    const bot = this.bots.get(accountId);
    if (!bot) {
      throw new Error(`No bot found for account ${accountId}`);
    }

    try {
      // Get or create DM channel with the user
      const user = await bot.client.users.fetch(userId);
      const dmChannel = await user.createDM();
      
      console.log(`📤 Sending message to user ${userId} via channel ${dmChannel.id}`);
      return await bot.sendMessage(dmChannel.id, content);
    } catch (error) {
      console.error(`❌ Error in BotManager.sendMessage:`, error);
      throw error;
    }
  }

  getBotStatus() {
    return {
      totalBots: this.bots.size,
      activeBots: Array.from(this.bots.keys())
    };
  }
}

// Real-time subscription to watch for new accounts
async function setupRealtimeSubscription(botManager) {
  const subscription = supabase
    .channel('accounts_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'accounts'
      },
      async (payload) => {
        console.log('🆕 New account added:', payload.new);
        try {
          await botManager.addBot(payload.new.id, payload.new.token);
        } catch (error) {
          console.error('Error adding new bot:', error);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'accounts'
      },
      async (payload) => {
        console.log('🗑️ Account deleted:', payload.old);
        await botManager.removeBot(payload.old.id);
      }
    )
    .subscribe();

  console.log('📡 Real-time subscription established');
  return subscription;
}

// Simple HTTP server for health checks and manual message sending
const express = require('express');
const app = express();
app.use(express.json());

let botManager;

app.get('/health', (req, res) => {
  const status = botManager.getBotStatus();
  res.json({
    status: 'healthy',
    ...status,
    uptime: process.uptime()
  });
});

app.post('/send-message', async (req, res) => {
  try {
    console.log('📤 Send message request:', req.body);
    const { accountId, userId, content } = req.body;
    
    if (!accountId || !userId || !content) {
      console.log('❌ Missing required fields:', { accountId, userId, content });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`🚀 Attempting to send message from account ${accountId} to user ${userId}`);
    const result = await botManager.sendMessage(accountId, userId, content);
    console.log('✅ Message sent successfully:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ Error in send-message endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the service
async function main() {
  console.log('🚀 Starting Discord CRM Bot Service...');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration');
    process.exit(1);
  }

  try {
    // Initialize bot manager
    botManager = new BotManager();
    
    // Set up real-time subscriptions
    await setupRealtimeSubscription(botManager);
    
    // Start HTTP server
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🌐 HTTP server running on port ${PORT}`);
    });

    console.log('✅ Discord CRM Bot Service is running!');
    
  } catch (error) {
    console.error('❌ Failed to start service:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Gracefully shutting down...');
  
  if (botManager) {
    for (const [accountId] of botManager.bots) {
      await botManager.removeBot(accountId);
    }
  }
  
  process.exit(0);
});

// Add express to package.json dependencies
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DiscordCRMBot, BotManager }; 