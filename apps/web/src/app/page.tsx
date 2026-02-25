'use client';

import { useState } from 'react';
import { useWebRTC } from '@/context/webrtc-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CallInterface } from '@/components/CallInterface';
import { Phone, Wifi, WifiOff, AlertCircle } from 'lucide-react';

export default function HomePage() {
  const [roomId, setRoomId] = useState('');
  const { callState, isConnected, connectionStatus } = useWebRTC();

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      window.location.href = `/room/${roomId}`;
    }
  };

  if (callState.isInCall) {
    return <CallInterface />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">NoCap Meet</h1>
          <p className="text-gray-600">Private video calling</p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2 text-sm">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-green-600 font-medium">{connectionStatus}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-orange-500" />
              <span className="text-orange-600 font-medium">{connectionStatus}</span>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room ID
            </label>
            <Input
              type="text"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full"
            />
          </div>

          <Button
            onClick={handleJoinRoom}
            disabled={!roomId.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-5 h-5 mr-2" />
            Join Room
          </Button>

          {!isConnected && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-700">
                <p className="font-medium">Server not connected</p>
                <p className="text-xs mt-1">Make sure the Go server is running on port 8080</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            Server: {process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080'}
          </p>
        </div>
      </div>
    </div>
  );
}
