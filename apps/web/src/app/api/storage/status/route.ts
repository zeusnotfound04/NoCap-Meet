import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';

export async function GET() {
  try {
    const status = await RedisStorageManager.checkStorageAvailability();
    const isConnected = RedisStorageManager.isConnected();
    
    return NextResponse.json({ 
      success: true, 
      data: {
        ...status,
        connected: isConnected
      }
    });
  } catch (error) {
    console.error('Error checking storage status:', error);
    return NextResponse.json(
      { error: 'Failed to check storage status' },
      { status: 500 }
    );
  }
}

// POST /api/storage/init
export async function POST() {
  try {
    await RedisStorageManager.initializeStorage();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Storage initialized successfully' 
    });
  } catch (error) {
    console.error('Error initializing storage:', error);
    return NextResponse.json(
      { error: 'Failed to initialize storage' },
      { status: 500 }
    );
  }
}
