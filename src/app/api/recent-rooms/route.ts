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

    const recentRooms = await RedisStorageManager.getRecentRooms(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: recentRooms 
    });
  } catch (error) {
    console.error('Error getting recent rooms:', error);
    return NextResponse.json(
      { error: 'Failed to get recent rooms' },
      { status: 500 }
    );
  }
}

// POST /api/recent-rooms
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, roomId, roomName } = body;

    if (!userId || !roomId) {
      return NextResponse.json(
        { error: 'userId and roomId are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.addToRecentRooms(roomId, userId, roomName);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Room added to recent successfully' 
    });
  } catch (error) {
    console.error('Error adding room to recent:', error);
    return NextResponse.json(
      { error: 'Failed to add room to recent' },
      { status: 500 }
    );
  }
}

// DELETE /api/recent-rooms
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

    await RedisStorageManager.clearRecentRooms(userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Recent rooms cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing recent rooms:', error);
    return NextResponse.json(
      { error: 'Failed to clear recent rooms' },
      { status: 500 }
    );
  }
}
