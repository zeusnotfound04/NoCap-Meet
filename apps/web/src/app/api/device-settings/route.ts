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

    const deviceSettings = await RedisStorageManager.getDeviceSettings(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: deviceSettings 
    });
  } catch (error) {
    console.error('Error getting device settings:', error);
    return NextResponse.json(
      { error: 'Failed to get device settings' },
      { status: 500 }
    );
  }
}

// POST /api/device-settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, settings } = body;

    if (!userId || !settings) {
      return NextResponse.json(
        { error: 'userId and settings are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.setDeviceSettings(settings, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Device settings saved successfully' 
    });
  } catch (error) {
    console.error('Error saving device settings:', error);
    return NextResponse.json(
      { error: 'Failed to save device settings' },
      { status: 500 }
    );
  }
}
