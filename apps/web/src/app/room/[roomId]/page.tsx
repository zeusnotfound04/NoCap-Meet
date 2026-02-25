'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWebRTC } from '@/context/webrtc-context';
import { CallInterface } from '@/components/CallInterface';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { joinRoom, callState, connectionStatus } = useWebRTC();
  const roomId = params.roomId as string;

  useEffect(() => {
    if (roomId && !callState.isInCall) {
      console.log(`[RoomPage] Auto-joining room: ${roomId}`);
      joinRoom(roomId);
    }
  }, [roomId, callState.isInCall, joinRoom]);

  if (!callState.isInCall) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Joining Room: {roomId}</h1>
          <p className="text-gray-600">{connectionStatus}</p>
        </div>
      </main>
    );
  }

  return <CallInterface />;
}
