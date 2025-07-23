#!/bin/bash

# Discord CRM Setup Script
echo "🚀 Setting up Discord CRM Dashboard..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi

# Install Discord bot dependencies
echo "📦 Installing Discord bot dependencies..."
cd discord-bot
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Discord bot dependencies"
    exit 1
fi

cd ..

# Create environment files if they don't exist
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local template..."
    cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
EOF
    echo "⚠️  Please update .env.local with your Supabase credentials"
fi

if [ ! -f "discord-bot/.env" ]; then
    echo "📝 Creating Discord bot .env template..."
    cat > discord-bot/.env << EOF
# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Server Configuration
PORT=3001
EOF
    echo "⚠️  Please update discord-bot/.env with your Supabase credentials"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set up your Supabase project and run the SQL schema from supabase-schema.sql"
echo "2. Update .env.local with your Supabase credentials"
echo "3. Update discord-bot/.env with your Supabase credentials"
echo "4. Start the frontend: npm run dev"
echo "5. Start the bot service: cd discord-bot && npm run dev"
echo ""
echo "🌐 The dashboard will be available at http://localhost:3000"
echo "🤖 The bot service will run on http://localhost:3001"
echo ""
echo "📖 For detailed instructions, see README.md" 