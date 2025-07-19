import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, data } = body;

    if (!userId || !data) {
      return NextResponse.json(
        { error: 'userId and data are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.importAllData(data, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Data imported successfully' 
    });
  } catch (error) {
    console.error('Error importing data:', error);
    return NextResponse.json(
      { error: 'Failed to import data' },
      { status: 500 }
    );
  }
}
