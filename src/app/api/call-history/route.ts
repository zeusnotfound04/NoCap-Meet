import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const callHistory = await RedisStorageManager.getCallHistory(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: callHistory 
    });
  } catch (error) {
    console.error('Error getting call history:', error);
    return NextResponse.json(
      { error: 'Failed to get call history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, call } = body;

    if (!userId || !call) {
      return NextResponse.json(
        { error: 'userId and call data are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.addCallToHistory(call, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Call added to history successfully' 
    });
  } catch (error) {
    console.error('Error adding call to history:', error);
    return NextResponse.json(
      { error: 'Failed to add call to history' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.clearCallHistory(userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Call history cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing call history:', error);
    return NextResponse.json(
      { error: 'Failed to clear call history' },
      { status: 500 }
    );
  }
}

// PATCH /api/call-history
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, peerId, updates } = body;

    if (!userId || !peerId || !updates) {
      return NextResponse.json(
        { error: 'userId, peerId, and updates are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.updateCallHistory(userId, peerId, updates);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Call history updated successfully' 
    });
  } catch (error) {
    console.error('Error updating call history:', error);
    return NextResponse.json(
      { error: 'Failed to update call history' },
      { status: 500 }
    );
  }
}
