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

    const exportedData = await RedisStorageManager.exportAllData(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: exportedData 
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
