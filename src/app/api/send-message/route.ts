import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, userId, content } = body;

    if (!accountId || !userId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId, userId, content' },
        { status: 400 }
      );
    }

    console.log('🔄 Proxying message to bot service:', { accountId, userId, content: content.substring(0, 50) + '...' });

    // Get bot service URL from environment
    const botServiceUrl = process.env.BOT_SERVICE_URL || process.env.NEXT_PUBLIC_BOT_SERVICE_URL || 'http://localhost:3001';
    
    // Forward request to bot service
    const response = await fetch(`${botServiceUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountId,
        userId,
        content,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Bot service error:', response.status, errorData);
      return NextResponse.json(
        { error: errorData.error || `Bot service error: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('✅ Message sent via bot service:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 