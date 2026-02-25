import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';
import { UserProfile } from '@/types/calling';

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

    const profile = await RedisStorageManager.getUserProfile(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: profile 
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    return NextResponse.json(
      { error: 'Failed to get user profile' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, profile } = body;

    if (!userId || !profile) {
      return NextResponse.json(
        { error: 'userId and profile are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.setUserProfile(profile as UserProfile, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Profile saved successfully' 
    });
  } catch (error) {
    console.error('Error saving user profile:', error);
    return NextResponse.json(
      { error: 'Failed to save user profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: 'userId and status are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.updateUserStatus(status, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Status updated successfully' 
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}
