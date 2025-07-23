# Discord CRM Bot Service

This service manages Discord bot instances for recording DM conversations and sending messages through the Discord API.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with the following variables:
   ```env
   # Supabase Configuration
   SUPABASE_URL=your-supabase-project-url
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   
   # Server Configuration
   PORT=3001
   ```

3. Start the service:
   ```bash
   npm run dev  # Development mode with nodemon
   npm start    # Production mode
   ```

## Features

- **Multi-Account Support**: Manages multiple Discord bot instances simultaneously
- **Real-time Message Recording**: Automatically records all DM messages to Supabase
- **Real-time Account Management**: Automatically starts/stops bots when accounts are added/removed
- **Message Sending**: API endpoint for sending messages through Discord
- **Health Monitoring**: Health check endpoint for monitoring service status

## API Endpoints

### Health Check
```http
GET /health
```

Returns the current status of all bot instances.

### Send Message
```http
POST /send-message
Content-Type: application/json

{
  "accountId": "uuid-of-account",
  "userId": "discord-user-id",
  "content": "Message to send"
}
```

Sends a message to a user via the specified account's bot.

## How it Works

1. The service reads all accounts from the Supabase database on startup
2. For each account, it creates a Discord bot instance using the stored token
3. Each bot listens for DM messages and records them to the database
4. Real-time subscriptions ensure new accounts are automatically added
5. The HTTP API allows sending messages programmatically

## Security Notes

- Discord tokens are stored encrypted in the database
- The service uses Supabase service role key for database access
- Each bot instance runs with minimal required permissions (DM access only)
- Graceful shutdown handling ensures all bots are properly disconnected

## Requirements

- Node.js 16+
- Access to Discord API (bot tokens)
- Supabase project with proper database schema
- Network access for Discord API connections 