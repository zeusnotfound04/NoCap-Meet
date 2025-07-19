"use client";
import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useMeetingStore } from "@/store/meeting";
import { PEER_CONFIG } from "@/contants";
import { IncomingCall } from "@/types/calling";
import { PeerData } from "@/types/peer";


interface PeerStatus {
  type: 
    | "idle"
    | "waiting_for_name"
    | "connecting" 
    | "connected"
    | "error"
    | "permission"
    | "calling_peer"
    | "incoming_call"
    | "in_call"
    | "call_ended";
  error?: string;
  remoteStream?: MediaStream;
}

interface PeerContextType {
  peer: React.RefObject<Peer | null>;
  chatConn: React.MutableRefObject<DataConnection | null>;
  
  status: PeerStatus;
  incomingCall: MediaConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  myPeerId: string | null;
  
  makeCall: (targetPeerId: string, callType?: 'video' | 'audio') => Promise<boolean>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  
  toggleAudio: () => boolean;
  toggleVideo: () => boolean;
  initializeMedia: (constraints?: MediaStreamConstraints) => Promise<MediaStream | null>;
  
  sendChatMessage: (message: string, targetPeerId?: string) => boolean;
  
  reconnect: () => void;
  initializePeerWithName: (userName: string) => void;
  
  // Utility functions
  testRingtone: () => void;
  stopRingtone: () => void;
}


const PeerContext = React.createContext<PeerContextType | undefined>(undefined);

export const PeerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const peerRef = useRef<Peer | null>(null);
  const chatConn = useRef<DataConnection | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [status, setStatus] = useState<PeerStatus>({ type: "waiting_for_name" });
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  
  const callStartTime = useRef<Date | null>(null);
  const currentCallPeerId = useRef<string | null>(null);
  
  const {
    userProfile,
    contacts,
    setMyPeerId: setStorePeerId,
    setConnectionStatus,
    setIncomingCall: setStoreIncomingCall,
    acceptCall: storeAcceptCall,
    endCall: storeEndCall,
    setCallConnected,
    addCallToHistory,
    updateCallHistory,
    userPreferences,
  } = useMeetingStore();

  const getMediaPermissions = useCallback(async (
    constraints: MediaStreamConstraints = { 
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
      video: true 
    }
  ): Promise<MediaStream | null> => {
    try {
      setStatus({ type: "permission" });
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      try {
        const localVideo = document.getElementById('local-video') as HTMLVideoElement;
        if (localVideo) {
          localVideo.srcObject = stream;
          localVideo.muted = true;
          localVideo.play().catch(error => {
            console.warn(' : Error playing local video:', error);
          });
        }
      } catch (error) {
        console.warn(' Error setting local video:', error);
      }
      
      console.log(' Media permissions granted');
      return stream;
    } catch (error: any) {
      console.error('Media permission denied:', error);
      setStatus({ type: "error", error: "Camera/microphone access denied" });
      return null;
    }
  }, []);

  const initializeMedia = useCallback(async (
    constraints?: MediaStreamConstraints
  ): Promise<MediaStream | null> => {
    if (localStream) {
      return localStream;
    }
    return await getMediaPermissions(constraints);
  }, [localStream, getMediaPermissions]);

  const toggleAudio = useCallback((): boolean => {
    if (!localStream) return false;
    
    const audioTracks = localStream.getAudioTracks();
    const newState = !audioTracks[0]?.enabled;
    
    audioTracks.forEach(track => {
      track.enabled = newState;
    });
    
    console.log(`🎤 Nocap-Meet: Audio ${newState ? 'unmuted' : 'muted'}`);
    return newState;
  }, [localStream]);

  const toggleVideo = useCallback((): boolean => {
    if (!localStream) return false;
    
    const videoTracks = localStream.getVideoTracks();
    const newState = !videoTracks[0]?.enabled;
    
    videoTracks.forEach(track => {
      track.enabled = newState;
    });
    
    console.log(`📹 Nocap-Meet: Video ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }, [localStream]);


  const makeCall = useCallback(async (
    targetPeerId: string, 
    callType: 'video' | 'audio' = 'video'
  ): Promise<boolean> => {
    if (!peerRef.current) {
      console.error('Cannot make call - peer not ready');
      setStatus({ type: "error", error: "Connection not ready" });
      return false;
    }

    if (activeCallRef.current || incomingCall) {
      setStatus({ type: "error", error: "Already in a call" });
      return false;
    }

    try {
      setStatus({ type: "calling_peer" });

      const constraints = {
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
        video: callType === 'video'
      };
      
      const stream = await getMediaPermissions(constraints);
      if (!stream) {
        return false;
      }

      const dataConn = peerRef.current.connect(targetPeerId, { label: "chat" });
      chatConn.current = dataConn;
      setupDataConnection(dataConn);

      const call = peerRef.current.call(targetPeerId, stream, {
        metadata: {
          callerName: userProfile?.name || 'Unknown',
          callerAvatar: userProfile?.avatar,
          callType,
        }
      });

      activeCallRef.current = call;
      setIncomingCall(call);
      setupCallEventHandlers(call);

      currentCallPeerId.current = targetPeerId;

      await addCallToHistory({
        peerId: targetPeerId,
        name: 'Calling...',
        type: 'outgoing',
        callType,
        timestamp: new Date(),
      });

      return true;
      
    } catch (error: any) {
      console.error('Failed to make call:', error);
      setStatus({ type: "error", error: error.message || "Failed to make call" });
      return false;
    }
  }, [userProfile, getMediaPermissions, addCallToHistory]);

  const acceptCall = useCallback(async (): Promise<void> => {
    if (!incomingCall) {
      console.error('No incoming call to accept');
      return;
    }

    // Stop the ringtone when accepting the call
    stopNotificationSound();

    try {
      let stream = localStream;
      if (!stream) {
        const callType = incomingCall.metadata?.callType || 'video';
        const constraints = {
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
          },
          video: callType === 'video'
        };
        stream = await getMediaPermissions(constraints);
        if (!stream) return;
      }

      incomingCall.answer(stream);
      activeCallRef.current = incomingCall;

      currentCallPeerId.current = incomingCall.peer;

      if (!chatConn.current && peerRef.current) {
        const dataConn = peerRef.current.connect(incomingCall.peer, { label: "chat" });
        chatConn.current = dataConn;
        setupDataConnection(dataConn);
      }

      storeAcceptCall();
      setStatus({ type: "in_call" });
      
    } catch (error: any) {
      console.error('Failed to accept call:', error);
      setStatus({ type: "error", error: error.message || "Failed to accept call" });
    }
  }, [incomingCall, localStream, getMediaPermissions, storeAcceptCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    // Stop the ringtone when rejecting the call
    stopNotificationSound();

    incomingCall.close();
    
    if (peerRef.current) {
      const rejectConn = peerRef.current.connect(incomingCall.peer, { label: "call_rejected" });
      rejectConn.on('open', () => {
        rejectConn.close();
      });
    }
    
    updateCallHistory(incomingCall.peer, { type: 'missed' });
    
    setIncomingCall(null);
    activeCallRef.current = null;
    setStatus({ type: "connected" });
    
  }, [incomingCall, updateCallHistory]);

  const endCall = useCallback(() => {
    // Stop any ringtone that might still be playing
    stopNotificationSound();

    if (activeCallRef.current) {
      activeCallRef.current.close();
      activeCallRef.current = null;
    }

    if (incomingCall && incomingCall !== activeCallRef.current) {
      incomingCall.close();
    }

    if (chatConn.current) {
      chatConn.current.close();
      chatConn.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }

    try {
      const localVideo = document.getElementById('local-video') as HTMLVideoElement;
      const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement;
      
      if (localVideo && localVideo.srcObject) {
        localVideo.srcObject = null;
      }
      if (remoteVideo && remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
      }
    } catch (error) {
      console.warn(' Error clearing video elements:', error);
    }

    setIncomingCall(null);
    setRemoteStream(null);
    setStatus({ type: "call_ended" });
    
    if (callStartTime.current && currentCallPeerId.current) {
      const duration = Math.floor((new Date().getTime() - callStartTime.current.getTime()) / 1000);
      updateCallHistory(currentCallPeerId.current, { duration });
    }
    
    callStartTime.current = null;
    currentCallPeerId.current = null;
    
    storeEndCall();

    setTimeout(() => {
      setStatus({ type: "connected" });
    }, 2000);
  }, [localStream, incomingCall, storeEndCall, updateCallHistory]);


  const setupCallEventHandlers = useCallback((call: MediaConnection) => {
    call.on('stream', (stream: MediaStream) => {
      console.log('📺 Nocap-Meet: Received remote stream');
      setRemoteStream(stream);
      setStatus({ type: "in_call", remoteStream: stream });
      
      if (!callStartTime.current) {
        callStartTime.current = new Date();
        setCallConnected();
        
        if (currentCallPeerId.current) {
          const contact = contacts.find(c => c.peerId === currentCallPeerId.current);
          if (contact) {
            updateCallHistory(currentCallPeerId.current, { name: contact.name });
            console.log(' Updated call history with contact name:', contact.name);
          }
        }
      }
      
      try {
        const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
          remoteVideo.play().catch(error => {
            console.warn('  Error playing remote video:', error);
          });
        }
      } catch (error) {
        console.warn(' Error setting remote video:', error);
      }
    });

    call.on('close', () => {
      console.log(' Call closed by remote');
      endCall();
    });

    call.on('error', (error: any) => {
      console.error('Call error:', error);
      setStatus({ type: "error", error: error.message || "Call failed" });
      endCall();
    });
  }, [endCall, contacts, updateCallHistory, setCallConnected]);

  const setupDataConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      console.log(' Chat connection opened with:', conn.peer);
    });

    conn.on('data', (data: unknown) => {
      
      if (typeof data === 'object' && data !== null && 'type' in data) {
        const peerData = data as PeerData;
        
        if (peerData.type === 'chat' && peerData.payload?.message) {
          
          const chatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            senderId: peerData.senderId || conn.peer,
            senderName: peerData.payload.senderName || 'Unknown',
            message: peerData.payload.message,
            timestamp: new Date(peerData.timestamp),
            type: 'text' as const,
          };
          
          const { addMessage } = useMeetingStore.getState();
          addMessage(chatMessage);
          
          console.log(' Chat message added to store:', chatMessage);
        }
      } else {
        console.warn(' Received invalid chat data format:', data);
      }
    });

    conn.on('close', () => {
      console.log(' Chat connection closed');
    });

    conn.on('error', (error: any) => {
      console.error(' Chat connection error:', error);
    });
  }, []);


  const sendChatMessage = useCallback((message: string, targetPeerId?: string): boolean => {
    if (!chatConn.current || !chatConn.current.open) {
      return false;
    }

    if (!userProfile) {
      return false;
    }

    if (!message.trim()) {
      return false;
    }

    try {
      const chatData: PeerData = {
        type: 'chat',
        payload: {
          message: message.trim(),
          senderName: userProfile.name,
        },
        timestamp: new Date(),
        senderId: myPeerId || '',
      };

      chatConn.current.send(chatData);

      const localMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: myPeerId || '',
        senderName: userProfile.name,
        message: message.trim(),
        timestamp: new Date(),
        type: 'text' as const,
      };

      const { addMessage } = useMeetingStore.getState();
      addMessage(localMessage);

      console.log(' Chat message sent:', message.trim());
      return true;
    } catch (error) {
      console.error(' Failed to send chat message:', error);
      return false;
    }
  }, [userProfile, myPeerId]);


  const initializePeer = useCallback((customName?: string) => {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (error) {
        console.warn(' Error destroying existing peer:', error);
      }
      peerRef.current = null;
    }

    setStatus({ type: "connecting" });

    const generateCustomPeerId = (): string => {
      const userName = customName || userProfile?.name;
      
      if (!userName || userName.trim() === '') {
        const threeDayNumber = getThreeDayBasedNumber();
        return `user_${threeDayNumber}`;
      }
      
      const cleanName = userName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const finalName = cleanName || 'user';
      
      const threeDayNumber = getThreeDayBasedNumber(finalName);
      const peerId = `${finalName}_${threeDayNumber}`;
      
      return peerId;
    };

    const getThreeDayBasedNumber = (seed?: string): number => {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
      
      const threeDayPeriod = Math.floor(dayOfYear / 3);
      
      let hash = 0;
      if (seed) {
        for (let i = 0; i < seed.length; i++) {
          const char = seed.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; 
        }
      }
      
      const combinedNumber = (threeDayPeriod * 1000 + Math.abs(hash) % 1000) % 9000 + 1000;
      
      return combinedNumber;
    };

    const customPeerId = generateCustomPeerId();

    const peer = new Peer(customPeerId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', (peerId) => {
      console.log(' Peer connected with ID:', peerId);
      setMyPeerId(peerId);
      setStorePeerId(peerId);
      setConnectionStatus('connected');
      setStatus({ type: "connected" });
    });

    peer.on('call', (call) => {
      console.log(' Incoming call from:', call.peer);
      
      if (activeCallRef.current || incomingCall) {
        console.log(' Already in call, rejecting');
        call.close();
        return;
      }

      setIncomingCall(call);
      setupCallEventHandlers(call);
      setStatus({ type: "incoming_call" });

      if (userPreferences.soundEnabled) {
        playNotificationSound();
      }

      const incomingCallData: IncomingCall = {
        callId: `call-${Date.now()}`,
        callerPeerId: call.peer,
        callerName: call.metadata?.callerName || 'Unknown',
        callerAvatar: call.metadata?.callerAvatar,
        timestamp: new Date(),
        type: call.metadata?.callType || 'video',
      };
      setStoreIncomingCall(incomingCallData);
      
      addCallToHistory({
        peerId: call.peer,
        name: call.metadata?.callerName || 'Unknown Caller',
        type: 'incoming',
        callType: call.metadata?.callType || 'video',
        timestamp: new Date(),
      });
    });

    peer.on('connection', (conn) => {
      
      if (conn.label === "call_rejected") {
        conn.close();
        setStatus({ type: "error", error: "Call was declined" });
        return;
      }
      
      if (conn.label === "chat") {
        chatConn.current = conn;
        setupDataConnection(conn);
      }
    });

    peer.on('disconnected', () => {
      console.log('🔌 Nocap-Meet: Peer disconnected');
      setStatus({ type: "idle" });
      setConnectionStatus('disconnected');
    });

    peer.on('close', () => {
      setStatus({ type: "idle" });
      setConnectionStatus('disconnected');
    });

    peer.on('error', (error: any) => {
      console.error('🔥 PeerJS Error:', error);
      
      if (error.type === 'unavailable-id') {
        console.log('🔄 ID taken, generating new one with random suffix...');
        
        const userName = customName || userProfile?.name || 'user';
        const cleanName = userName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
        
        const timestamp = Date.now().toString().slice(-4);
        const randomSuffix = Math.floor(Math.random() * 999) + 100;
        const newPeerId = `${cleanName}_${timestamp}_${randomSuffix}`;
        
        console.log('🆔 Retrying with new peer ID:', newPeerId);
        
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
        
        setTimeout(() => {
          const newPeer = new Peer(newPeerId, PEER_CONFIG);
          peerRef.current = newPeer;
          
          newPeer.on('open', (retryPeerId) => {
            setMyPeerId(retryPeerId);
            setStorePeerId(retryPeerId);
            setConnectionStatus('connected');
            setStatus({ type: "connected" });
          });
          
          newPeer.on('call', (call) => {
            
            if (activeCallRef.current || incomingCall) {
              call.close();
              return;
            }

            setIncomingCall(call);
            setupCallEventHandlers(call);
            setStatus({ type: "incoming_call" });

            if (userPreferences.soundEnabled) {
              playNotificationSound();
            }

            const incomingCallData: IncomingCall = {
              callId: `call-${Date.now()}`,
              callerPeerId: call.peer,
              callerName: call.metadata?.callerName || 'Unknown',
              callerAvatar: call.metadata?.callerAvatar,
              timestamp: new Date(),
              type: call.metadata?.callType || 'video',
            };
            setStoreIncomingCall(incomingCallData);
            
            addCallToHistory({
              peerId: call.peer,
              name: call.metadata?.callerName || 'Unknown Caller',
              type: 'incoming',
              callType: call.metadata?.callType || 'video',
              timestamp: new Date(),
            });
          });

          newPeer.on('connection', (conn) => {
            if (conn.label === "call_rejected") {
              conn.close();
              setStatus({ type: "error", error: "Call was declined" });
              return;
            }
            
            if (conn.label === "chat") {
              chatConn.current = conn;
              setupDataConnection(conn);
            }
          });

          newPeer.on('disconnected', () => {
            console.log('🔌 Peer disconnected');
            setStatus({ type: "idle" });
            setConnectionStatus('disconnected');
          });

          newPeer.on('close', () => {
            setStatus({ type: "idle" });
            setConnectionStatus('disconnected');
          });

          newPeer.on('error', (retryError: any) => {
            console.error('🔥 Retry peer error:', retryError);
            setStatus({ type: "error", error: retryError.message || "Connection failed" });
            setConnectionStatus('error');
          });
          
        }, 1000);
        
        return;
      }
      
      setStatus({ type: "error", error: error.message || "Connection failed" });
      setConnectionStatus('error');
    });

  }, [setStorePeerId, setConnectionStatus, setStoreIncomingCall, userPreferences.soundEnabled]);

  const reconnect = useCallback(() => {
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    setStatus({ type: "idle" });
    setTimeout(initializePeer, 1000);
  }, [initializePeer]);

  const initializePeerWithName = useCallback((userName: string) => {
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    setStatus({ type: "connecting" });
    setTimeout(() => {
      initializePeer(userName);
    }, 500);
  }, [initializePeer]);

  useEffect(() => {
    
    if (userProfile?.name) {
      initializePeer(userProfile.name);
    } else {
      setStatus({ type: "waiting_for_name" });
    }
    
    return () => {
      
      if (activeCallRef.current) {
        activeCallRef.current.close();
        activeCallRef.current = null;
      }
      
      if (incomingCall) {
        incomingCall.close();
      }
      
      if (chatConn.current) {
        chatConn.current.close();
        chatConn.current = null;
      }
      
      if (localStream) {
        localStream.getTracks().forEach(track => {
          try {
            track.stop();
            console.log(' Cleanup - stopped track:', track.kind);
          } catch (error) {
            console.warn('  Error stopping track:', error);
          }
        });
      }
      
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
          peerRef.current = null;
        } catch (error) {
          console.warn('  Error destroying peer:', error);
        }
      }
      
      // Stop any playing ringtone
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
        ringtoneAudioRef.current = null;
      }
      
      setStatus({ type: "idle" });
    };
  }, [userProfile?.name, initializePeer]); 


  const playNotificationSound = useCallback(() => {
    if (!userPreferences.soundEnabled) {
      console.log('🔇 Ringtone disabled in user preferences');
      return;
    }

    try {
      // Stop any existing ringtone first
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
      }

      // Create new audio instance for the ringtone
      const audio = new Audio('/ringtone.mp3');
      ringtoneAudioRef.current = audio;
      
      // Configure the audio
      audio.loop = true;
      audio.volume = 0.7; // Set volume to 70%
      
      // Add event listeners for better feedback
      audio.addEventListener('canplaythrough', () => {
        console.log('🔊 Ringtone loaded and ready to play');
      });
      
      audio.addEventListener('play', () => {
        console.log('🔊 Incoming call ringtone started playing...');
      });
      
      audio.addEventListener('error', (e) => {
        console.error('❌ Error loading ringtone:', e);
      });
      
      // Play the ringtone
      audio.play().catch(error => {
        console.warn('🔊 Could not play ringtone (may need user interaction first):', error);
      });
      
      // Auto-stop after 30 seconds as a safety measure
      setTimeout(() => {
        if (ringtoneAudioRef.current === audio) {
          audio.pause();
          audio.currentTime = 0;
          ringtoneAudioRef.current = null;
          console.log('🔇 Ringtone auto-stopped after 30 seconds');
        }
      }, 30000);
      
    } catch (error) {
      console.warn('❌ Error playing incoming call ringtone:', error);
    }
  }, [userPreferences.soundEnabled]);

  const stopNotificationSound = useCallback(() => {
    try {
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
        ringtoneAudioRef.current = null;
        console.log('🔇 Ringtone stopped');
      }
    } catch (error) {
      console.warn('❌ Error stopping ringtone:', error);
    }
  }, []);


  const contextValue: PeerContextType = {
    peer: peerRef,
    chatConn,
    
    status,
    incomingCall,
    localStream,
    remoteStream,
    isConnected: status.type === "connected" || status.type === "in_call" || status.type === "calling_peer",
    myPeerId,
    makeCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
    initializeMedia,
    sendChatMessage,
    reconnect,
    initializePeerWithName,
    testRingtone: playNotificationSound,
    stopRingtone: stopNotificationSound,
  };

  return (
    <PeerContext.Provider value={contextValue}>
      {children}
    </PeerContext.Provider>
  );
};


export function usePeer() {
  const context = useContext(PeerContext);
  if (context === undefined) {
    throw new Error("usePeer must be used within a PeerProvider");
  }
  return context;
}