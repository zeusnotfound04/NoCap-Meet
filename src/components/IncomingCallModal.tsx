'use client';

import { usePeer } from '@/context/peer-context';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video, User } from 'lucide-react';

export function IncomingCallModal() {
  const { status, incomingCall, acceptCall, rejectCall } = usePeer();

  if (status.type !== 'incoming_call' || !incomingCall) {
    return null;
  }

  const callerName = incomingCall.metadata?.callerName || 'Unknown';
  const callType = incomingCall.metadata?.callType || 'video';
  const callerAvatar = incomingCall.metadata?.callerAvatar;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 text-center">
        {/* Caller Avatar */}
        <div className="mb-6">
          {callerAvatar ? (
            <img 
              src={callerAvatar} 
              alt={callerName}
              className="w-24 h-24 rounded-full mx-auto object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full mx-auto bg-blue-500 flex items-center justify-center text-white text-3xl font-bold">
              {callerName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {callerName}
          </h3>
          <p className="text-gray-500 flex items-center justify-center gap-2">
            {callType === 'video' ? (
              <>
                <Video className="w-4 h-4" />
                Incoming video call
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                Incoming audio call
              </>
            )}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            From: {incomingCall.peer.slice(0, 8)}...
          </p>
        </div>
        
        <div className="flex gap-4 justify-center">
          <Button 
            variant="destructive" 
            onClick={rejectCall}
            className="flex-1 rounded-full h-14"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
          <Button 
            onClick={acceptCall}
            className="flex-1 rounded-full h-14 bg-green-500 hover:bg-green-600"
          >
            <Phone className="w-6 h-6" />
          </Button>
        </div>
        
        <p className="text-xs text-gray-400 mt-4">
          Accept to start the call
        </p>
      </div>
    </div>
  );
}