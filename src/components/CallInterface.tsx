'use client';

import { useState, useEffect } from 'react';
import { usePeer } from '@/context/peer-context';
import { useMeetingStore } from '@/store/meeting';
import { Button } from '@/components/ui/button';
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff,
  MessageSquare,
  Maximize,
  Minimize,
  User
} from 'lucide-react';
import { ChatWindow } from './ChatWindow';
import { ChatToggleButton } from './ChatToggleButton';

export function CallInterface() {
  const { 
    status, 
    toggleAudio, 
    endCall, 
    incomingCall
  } = usePeer();
  
  const { callState, isChatOpen, toggleChat, messages, userProfile, contacts } = useMeetingStore();
  
  const [isAudioMuted, setIsAudioMuted] = useState(false);
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

  useEffect(() => {
    if (status.type !== 'in_call') {
      setCallDuration(0);
      setIsAudioMuted(false);
      setIsFullscreen(false);
    }
  }, [status.type]);

  if (status.type !== 'in_call') {
    return null;
  }

  const handleToggleAudio = () => {
    const newState = toggleAudio();
    setIsAudioMuted(!newState);
    
    console.log('[AUDIO_TOGGLE] Local audio toggled:', { newState, muted: !newState });
    
    // Resume AudioContext on user interaction
    const resumeAudioContext = async () => {
      try {
        if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('[AUDIO_TOGGLE] AudioContext state:', audioContext.state);
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('[AUDIO_TOGGLE] AudioContext resumed successfully');
          }
        }
      } catch (error) {
        console.warn('[AUDIO_TOGGLE] Failed to resume AudioContext:', error);
      }
    };
    
    resumeAudioContext();
    
    try {
      const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;
      if (remoteAudio) {
        console.log('[AUDIO_TOGGLE] Remote audio element found:', {
          paused: remoteAudio.paused,
          volume: remoteAudio.volume,
          muted: remoteAudio.muted,
          srcObject: !!remoteAudio.srcObject
        });
        
        if (remoteAudio.paused) {
          remoteAudio.play()
            .then(() => console.log('[AUDIO_TOGGLE] Remote audio resumed'))
            .catch(err => console.warn('[AUDIO_TOGGLE] Failed to resume remote audio:', err));
        }
      } else {
        console.warn('[AUDIO_TOGGLE] Remote audio element not found');
      }
    } catch (error) {
      console.error('[AUDIO_TOGGLE] Error in audio toggle:', error);
    }
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
  const callerPeerId = incomingCall?.peer;
  const contact = contacts.find(c => c.peerId === callerPeerId);
  const callerAvatar = contact?.avatar || incomingCall?.metadata?.callerAvatar;

  // Handle click anywhere to resume audio context
  const handleCallInterfaceClick = async () => {
    try {
      if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log('[CALL_INTERFACE] AudioContext resumed on user interaction');
        }
      }
      
      // Also try to play the remote audio if it's paused
      const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;
      if (remoteAudio && remoteAudio.paused && remoteAudio.srcObject) {
        try {
          await remoteAudio.play();
          console.log('[CALL_INTERFACE] Remote audio resumed on user interaction');
        } catch (err) {
          console.warn('[CALL_INTERFACE] Failed to resume remote audio:', err);
        }
      }
    } catch (error) {
      console.warn('[CALL_INTERFACE] Failed to resume audio on interaction:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-br from-white via-blue-50 to-blue-100 z-50 flex flex-col"
      onClick={handleCallInterfaceClick}
    >
      <div className="bg-white bg-opacity-90 backdrop-blur-md border-b border-gray-200 text-gray-800 p-8 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black shadow-lg">
              {callerAvatar ? (
                <img
                  src={callerAvatar}
                  alt={callerName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-white">
                  {callerName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="font-bold text-xl text-gray-800">{callerName}</h1>
              <p className="text-gray-600 font-medium">
                {formatDuration(callDuration)}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(59, 130, 246, 0.5) 1px, transparent 0)`,
            backgroundSize: '60px 60px'
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-transparent to-blue-100 opacity-50" />

        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <div className="flex space-x-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-blue-500 rounded-full"
                style={{
                  height: `${40 + Math.sin(Date.now() * 0.001 + i) * 30}px`,
                  animation: `pulse ${1.5 + i * 0.1}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center text-gray-800 z-10">
          <div className="relative mb-10">
            <div className="w-56 h-56 relative">
              {callerAvatar ? (
                <img
                  src={callerAvatar}
                  alt={callerName}
                  className="w-56 h-56 rounded-full object-cover shadow-2xl ring-4 ring-white"
                />
              ) : (
                <div className="w-56 h-56 bg-black rounded-full flex items-center justify-center shadow-2xl ring-4 ring-white">
                  <User className="w-28 h-28 text-white" />
                </div>
              )}
              
              <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-opacity-30 animate-ping" />
              
              <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl ring-2 ring-blue-100">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <h2 className="text-4xl font-light mb-3 tracking-wide text-gray-800">{callerName}</h2>
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-lg font-light tracking-wide">Connected</span>
          </div>
        </div>

        <div className="absolute top-8 right-8 flex flex-col items-center">
          <div className="relative">
            <div className="w-20 h-20 relative">
              {userProfile?.avatar ? (
                <img
                  src={userProfile.avatar}
                  alt="You"
                  className="w-20 h-20 rounded-full object-cover shadow-xl ring-2 ring-white"
                />
              ) : (
                <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center shadow-xl ring-2 ring-white">
                  <User className="w-10 h-10 text-white" />
                </div>
              )}
            </div>
            
            {isAudioMuted && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-2 font-light">You</p>
        </div>

        {isAudioMuted && (
          <div className="absolute top-8 left-8 bg-white bg-opacity-90 backdrop-blur-md text-gray-800 px-6 py-3 rounded-full text-sm flex items-center gap-3 shadow-lg border border-gray-200">
            <MicOff className="w-4 h-4 text-red-500" />
            <span className="font-medium">Microphone muted</span>
          </div>
        )}
        
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-blue-100 bg-opacity-90 backdrop-blur-md text-gray-700 px-4 py-2 rounded-lg text-sm shadow-lg border border-blue-200">
          <span className="text-xs">If you can't hear audio, try clicking anywhere or toggle the microphone</span>
        </div>
      </div>

      <div className="bg-white bg-opacity-95 backdrop-blur-md border-t border-gray-200 p-8 shadow-lg">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-12">
            <Button
              variant="ghost"
              size="lg"
              onClick={handleToggleAudio}
              className={`rounded-full w-16 h-16 p-0 transition-all duration-300 shadow-xl ring-2 hover:scale-110 ${
                isAudioMuted 
                  ? "bg-red-500 hover:bg-red-600 text-white ring-red-400 ring-opacity-50" 
                  : "bg-blue-100 hover:bg-blue-200 text-gray-700 ring-blue-200 hover:ring-blue-300"
              }`}
              title={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Button>

            <Button
              variant="destructive"
              size="lg"
              onClick={endCall}
              className="rounded-full w-20 h-20 p-0 bg-red-500 hover:bg-red-600 text-white transition-all duration-300 shadow-xl hover:shadow-red-500/30 hover:scale-110 ring-2 ring-red-300"
              title="End call"
            >
              <PhoneOff className="w-8 h-8" />
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={toggleChat}
              className="rounded-full w-16 h-16 p-0 relative bg-blue-100 hover:bg-blue-200 text-gray-700 transition-all duration-300 shadow-xl ring-2 ring-blue-200 hover:ring-blue-300 hover:scale-110"
              title="Toggle chat"
            >
              <MessageSquare className="w-6 h-6" />
              {messages.length > 0 && !isChatOpen && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg">
                  {messages.length}
                </span>
              )}
            </Button>
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-600 text-lg font-light tracking-wide">
              {formatDuration(callDuration)}
            </p>
          </div>
        </div>
      </div>

      {isChatOpen && <ChatWindow />}

      <ChatToggleButton />
    </div>
  );
}