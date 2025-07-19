'use client';

import { useState, useEffect } from 'react';
import { usePeer } from '@/context/peer-context';
import { useMeetingStore } from '@/store/meeting';
import { Button } from '@/components/ui/button';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff,
  Monitor,
  MessageSquare,
  Maximize,
  Minimize
} from 'lucide-react';

export function CallInterface() {
  const { 
    status, 
    toggleAudio, 
    toggleVideo, 
    endCall, 
    localStream, 
    remoteStream,
    incomingCall 
  } = usePeer();
  
  const { callState } = useMeetingStore();
  
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (status.type !== 'in_call') {
      return;
    }

    const interval = setInterval(() => {
      if (callState.callStartTime) {
        const duration = Math.floor((Date.now() - callState.callStartTime.getTime()) / 1000);
        setCallDuration(duration);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status.type, callState.callStartTime]);

  // Reset states when not in call
  useEffect(() => {
    if (status.type !== 'in_call') {
      setCallDuration(0);
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      setIsFullscreen(false);
    }
  }, [status.type]);

  if (status.type !== 'in_call') {
    return null;
  }

  const handleToggleAudio = () => {
    const newState = toggleAudio();
    setIsAudioMuted(!newState);
  };

  const handleToggleVideo = () => {
    const newState = toggleVideo();
    setIsVideoMuted(!newState);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const callerName = incomingCall?.metadata?.callerName || 'Unknown';

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black bg-opacity-50 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
            {callerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{callerName}</p>
            <p className="text-sm text-gray-300">
              {formatDuration(callDuration)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <video
            id="remote-video"
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {!remoteStream && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-gray-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <VideoOff className="w-12 h-12" />
                </div>
                <p className="text-lg">Camera is off</p>
              </div>
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg">
          <video
            id="local-video"
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            You
          </div>
          
          {isVideoMuted && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>

        {isAudioMuted && (
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <MicOff className="w-4 h-4" />
            Muted
          </div>
        )}
      </div>

      <div className="bg-black bg-opacity-75 p-6">
        <div className="flex items-center justify-center gap-4">
          {/* Audio Toggle */}
          <Button
            variant={isAudioMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={handleToggleAudio}
            className="rounded-full w-14 h-14 p-0"
            title={isAudioMuted ? "Unmute" : "Mute"}
          >
            {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>

          <Button
            variant={isVideoMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={handleToggleVideo}
            className="rounded-full w-14 h-14 p-0"
            title={isVideoMuted ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoMuted ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </Button>

          {/* Screen Share (Future) */}
          <Button
            variant="secondary"
            size="lg"
            disabled
            className="rounded-full w-14 h-14 p-0 opacity-50"
            title="Screen share (coming soon)"
          >
            <Monitor className="w-6 h-6" />
          </Button>

          <Button
            variant="secondary"
            size="lg"
            disabled
            className="rounded-full w-14 h-14 p-0 opacity-50"
            title="Chat (coming soon)"
          >
            <MessageSquare className="w-6 h-6" />
          </Button>

          <Button
            variant="destructive"
            size="lg"
            onClick={endCall}
            className="rounded-full w-14 h-14 p-0 ml-4"
            title="End call"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
        
        <div className="text-center mt-4 text-white text-sm">
          <p>Call with {callerName} • {formatDuration(callDuration)}</p>
        </div>
      </div>
    </div>
  );
}