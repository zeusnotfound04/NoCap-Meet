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

    await RedisStorageManager.updatePeerId(peerId, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Peer ID updated successfully' 
    });
  } catch (error) {
    console.error('Error updating peer ID:', error);
    return NextResponse.json(
      { error: 'Failed to update peer ID' },
      { status: 500 }
    );
  }
}
