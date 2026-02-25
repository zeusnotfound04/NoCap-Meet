'use client';

import { useState, useEffect, useRef } from 'react';
import { useWebRTC } from '@/context/webrtc-context';
import { useMeetingStore } from '@/store/meeting';
import { Button } from '@/components/ui/button';
import { 
  Mic, 
  MicOff, 
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  User
} from 'lucide-react';

export function CallInterface() {
  const { 
    callState, 
    toggleAudio, 
    toggleVideo,
    leaveRoom,
    isAudioEnabled,
    isVideoEnabled
  } = useWebRTC();
  
  const { isChatOpen, toggleChat, messages } = useMeetingStore();
  
  const [callDuration, setCallDuration] = useState(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (!callState.isInCall) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState.isInCall]);

  useEffect(() => {
    if (localVideoRef.current && callState.localStream) {
      localVideoRef.current.srcObject = callState.localStream;
    }
  }, [callState.localStream]);

  useEffect(() => {
    callState.remoteStreams.forEach((stream, peerId) => {
      const videoElement = remoteVideosRef.current.get(peerId);
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    });
  }, [callState.remoteStreams]);

  if (!callState.isInCall) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="bg-gray-900 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Room: {callState.roomId}</h1>
              <p className="text-gray-400 text-sm">{formatDuration(callDuration)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-sm">
              You {!isVideoEnabled && '(Video Off)'}
            </div>
            {!isAudioEnabled && (
              <div className="absolute top-2 right-2 bg-red-500 rounded-full p-2">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {Array.from(callState.remoteStreams.entries()).map(([peerId, stream]) => (
            <div key={peerId} className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
              <video
                ref={(el) => {
                  if (el) {
                    remoteVideosRef.current.set(peerId, el);
                    el.srcObject = stream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-sm">
                Participant
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 p-6 shadow-lg">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="ghost"
              size="lg"
              onClick={toggleAudio}
              className={`rounded-full w-14 h-14 p-0 ${
                !isAudioEnabled 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={toggleVideo}
              className={`rounded-full w-14 h-14 p-0 ${
                !isVideoEnabled 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </Button>

            <Button
              variant="destructive"
              size="lg"
              onClick={leaveRoom}
              className="rounded-full w-16 h-16 p-0 bg-red-500 hover:bg-red-600"
            >
              <PhoneOff className="w-8 h-8" />
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={toggleChat}
              className="rounded-full w-14 h-14 p-0 bg-gray-700 hover:bg-gray-600 relative"
            >
              <MessageSquare className="w-6 h-6" />
              {messages.length > 0 && !isChatOpen && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {messages.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


