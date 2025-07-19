import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';

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

    await RedisStorageManager.clearAllData(userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'All user data cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing all data:', error);
    return NextResponse.json(
      { error: 'Failed to clear all data' },
      { status: 500 }
    );
  }
}
