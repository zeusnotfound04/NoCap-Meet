import { NextRequest, NextResponse } from 'next/server';
import { RedisStorageManager } from '@/lib/redis-server';
import { Contact } from '@/types/calling';

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

    const contacts = await RedisStorageManager.getContacts(userId);
    
    return NextResponse.json({ 
      success: true, 
      data: contacts 
    });
  } catch (error) {
    console.error('Error getting contacts:', error);
    return NextResponse.json(
      { error: 'Failed to get contacts' },
      { status: 500 }
    );
  }
}

// POST /api/contacts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, contact } = body;

    if (!userId || !contact) {
      return NextResponse.json(
        { error: 'userId and contact are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.addContact(contact as Contact, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Contact added successfully' 
    });
  } catch (error) {
    console.error('Error adding contact:', error);
    return NextResponse.json(
      { error: 'Failed to add contact' },
      { status: 500 }
    );
  }
}

// DELETE /api/contacts
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, peerId } = body;

    if (!userId || !peerId) {
      return NextResponse.json(
        { error: 'userId and peerId are required' },
        { status: 400 }
      );
    }

    await RedisStorageManager.removeContact(peerId, userId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Contact removed successfully' 
    });
  } catch (error) {
    console.error('Error removing contact:', error);
    return NextResponse.json(
      { error: 'Failed to remove contact' },
      { status: 500 }
    );
  }
}
