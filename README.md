# Discord CRM Dashboard

A modern CRM dashboard for managing Discord DM conversations with real-time message recording and multi-account support.

## 🚀 Features

- **Multi-Account Management**: Add and manage multiple Discord accounts
- **Real-time DM Recording**: Automatic recording of all DM conversations
- **Modern UI**: Built with ShadCN UI components and Tailwind CSS
- **Real-time Updates**: Live message updates using Supabase real-time subscriptions
- **Message Sending**: Send messages directly from the dashboard
- **Secure Storage**: Encrypted token storage with Supabase
- **Responsive Design**: Works on desktop and mobile devices

## 🛠 Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **ShadCN UI** for components
- **Supabase** for database and real-time features

### Backend
- **Node.js** Discord bot service
- **Discord.js** for Discord API interaction
- **Express.js** for HTTP endpoints
- **Supabase** for data persistence

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Discord application/bot tokens for each account you want to monitor

## 🔧 Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd discord-dm-crm
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor
3. Get your project URL and service role key from Project Settings > API

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 4. Discord Bot Service Setup

```bash
cd discord-bot
npm install
```

Create a `.env` file in the `discord-bot` directory:

```env
# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Server Configuration
PORT=3001
```

### 5. Running the Application

Start the Next.js frontend:
```bash
npm run dev
```

Start the Discord bot service (in a separate terminal):
```bash
cd discord-bot
npm run dev
```

The dashboard will be available at `http://localhost:3000`
The bot service will run on `http://localhost:3001`

## 🎯 Usage

### Adding Discord Accounts

1. Click "Add Account" in the sidebar
2. Enter a Discord bot token for the account you want to monitor
3. The token will be validated against the Discord API
4. Once validated, the account will be added and the bot will start monitoring DMs

### Viewing Conversations

1. Select an account from the sidebar
2. View all DM conversations for that account
3. Click on a conversation to view the full message history
4. Send new messages directly from the chat interface

### Discord Bot Token Setup

To get Discord bot tokens:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the bot token
5. Ensure the bot has the following permissions:
   - Send Messages
   - Read Message History
   - Use Slash Commands (optional)

## 🏗 Database Schema

The application uses two main tables:

### `accounts`
- `id`: UUID (Primary Key)
- `token`: Encrypted Discord bot token
- `user_id`: Discord user ID
- `username`: Discord username
- `avatar`: Avatar URL
- `created_at`: Timestamp

### `messages`
- `id`: UUID (Primary Key)
- `account_id`: Foreign key to accounts
- `discord_user_id`: Discord ID of DM partner
- `username`: Username of DM partner
- `avatar`: Avatar URL of DM partner
- `direction`: 'sent' or 'received'
- `content`: Message content
- `timestamp`: Message timestamp

## 🔒 Security Features

- **Token Encryption**: Discord tokens are stored encrypted in the database
- **Row Level Security**: Supabase RLS policies protect data access
- **Input Validation**: All user inputs are validated and sanitized
- **Secure Headers**: Security headers implemented for the web application
- **Environment Variables**: Sensitive data stored in environment variables

## 🚀 Deployment

### Frontend (Vercel/Netlify)

1. Connect your repository to Vercel or Netlify
2. Set environment variables in the deployment platform
3. Deploy the Next.js application

### Backend (Docker/VPS)

The Discord bot service can be deployed using Docker:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY discord-bot/package*.json ./
RUN npm ci --only=production
COPY discord-bot/ .
EXPOSE 3001
CMD ["npm", "start"]
```

Or deploy directly to a VPS:

```bash
cd discord-bot
npm install --production
pm2 start index.js --name discord-crm-bot
```

## 📊 Monitoring

The bot service includes a health check endpoint:

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "totalBots": 3,
  "activeBots": ["account-id-1", "account-id-2", "account-id-3"],
  "uptime": 12345
}
```

## 🚀 Port Configuration

### Development (Local Testing)
- **Frontend**: http://localhost:3000
- **Bot Service**: http://localhost:3001

### Production Deployment
The application is designed to be production-ready with environment variable configuration:

1. **Frontend (Next.js)**:
   - Set `PORT=8080` or your preferred port
   - Set `NEXT_PUBLIC_BOT_SERVICE_URL` to your bot service URL

2. **Bot Service**:
   - Set `PORT=3001` or your preferred port
   - Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Development
PORT=3000
NEXT_PUBLIC_BOT_SERVICE_URL=http://localhost:3001

# Production (example)
PORT=8080
NEXT_PUBLIC_BOT_SERVICE_URL=https://your-bot-service.herokuapp.com
```

### Deployment Platforms

**Frontend (Next.js)**:
- Vercel: Automatic deployment with environment variables
- Railway: Docker deployment with port configuration
- Heroku: Buildpack deployment

**Bot Service (Node.js)**:
- Railway: Node.js service deployment
- Heroku: Worker dyno deployment
- VPS: PM2 process management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## ⚠️ Disclaimers

- This application is for legitimate business purposes only
- Ensure compliance with Discord's Terms of Service
- Be mindful of privacy laws and regulations in your jurisdiction
- Use responsibly and respect users' privacy

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🐛 Troubleshooting

### Common Issues

**Bot not recording messages:**
- Verify the Discord token is valid
- Check bot permissions
- Ensure the bot service is running

**Database connection issues:**
- Verify Supabase credentials
- Check network connectivity
- Confirm database schema is properly set up

**Frontend not loading:**
- Check environment variables
- Verify Next.js is running on the correct port
- Check browser console for errors

For more help, check the logs or open an issue in the repository.
