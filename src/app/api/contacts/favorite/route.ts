import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, peerId } = body;

    if (!userId || !peerId) {
      return NextResponse.json(
        { error: 'userId and peerId are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.toggleContactFavorite(peerId, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Contact favorite toggled successfully' 
    });
  } catch (error) {
    console.error('Error toggling contact favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle contact favorite' },
      { status: 500 }
    );
  }
}
