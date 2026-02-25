import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';

// PATCH /api/contacts/last-call
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

    await RedisStorageManager.updateLastCall(peerId, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Last call updated successfully' 
    });
  } catch (error) {
    console.error('Error updating last call:', error);
    return NextResponse.json(
      { error: 'Failed to update last call' },
      { status: 500 }
    );
  }
}
