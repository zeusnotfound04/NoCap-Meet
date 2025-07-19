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

    const preferences = await RedisStorageManager.getUserPreferences(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: preferences 
    });
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to get user preferences' },
      { status: 500 }
    );
  }
}

// POST /api/user/preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, preferences } = body;

    if (!userId || !preferences) {
      return NextResponse.json(
        { error: 'userId and preferences are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.setUserPreferences(preferences, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'User preferences saved successfully' 
    });
  } catch (error) {
    console.error('Error saving user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to save user preferences' },
      { status: 500 }
    );
  }
}
