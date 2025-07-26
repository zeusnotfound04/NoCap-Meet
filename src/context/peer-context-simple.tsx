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
  sendChatMessage: (message: string, targetPeerId?: string) => boolean;
  
  reconnect: () => void;
  initializePeerWithName: (userName: string) => void;
  
  testRingtone: () => void;
  stopRingtone: () => void;
  checkMediaPermissions: () => Promise<{ microphone: PermissionState; }>;
}

const PeerContext = React.createContext<PeerContextType | undefined>(undefined);

export const PeerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const peerRef = useRef<Peer | null>(null);
  const chatConn = useRef<DataConnection | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [status, setStatus] = useState<PeerStatus>({ type: "waiting_for_name" });
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  
  const {
    userProfile,
    setMyPeerId: setStorePeerId,
    setConnectionStatus,
    setIncomingCall: setStoreIncomingCall,
    acceptCall: storeAcceptCall,
    endCall: storeEndCall,
    addCallToHistory,
    updateCallHistory,
    userPreferences,
  } = useMeetingStore();

  // Simple audio permission function
  const getAudioPermission = useCallback(async (): Promise<MediaStream | null> => {
    try {
      setStatus({ type: "permission" });
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      setLocalStream(stream);
      return stream;
    } catch (error: any) {
      let errorMessage = "Microphone access denied";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Please allow microphone access and try again";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No microphone found";
      }
      
      setStatus({ type: "error", error: errorMessage });
      return null;
    }
  }, []);

  // Simple make call function
  const makeCall = useCallback(async (
    targetPeerId: string, 
    callType: 'video' | 'audio' = 'audio'
  ): Promise<boolean> => {
    if (!peerRef.current) {
      setStatus({ type: "error", error: "Connection not ready" });
      return false;
    }

    if (incomingCall) {
      setStatus({ type: "error", error: "Already in a call" });
      return false;
    }

    try {
      setStatus({ type: "calling_peer" });

      let stream = localStream;
      if (!stream) {
        stream = await getAudioPermission();
        if (!stream) return false;
      }

      console.log('[MAKE_CALL] Making call to:', targetPeerId);
      
      const call = peerRef.current.call(targetPeerId, stream, {
        metadata: {
          callerName: userProfile?.name || 'Unknown',
          callerAvatar: userProfile?.avatar,
          callType,
        }
      });

      setIncomingCall(call);

      await addCallToHistory({
        peerId: targetPeerId,
        name: 'Calling...',
        type: 'outgoing',
        callType,
        timestamp: new Date(),
      });

      return true;
    } catch (error: any) {
      setStatus({ type: "error", error: error.message || "Failed to make call" });
      return false;
    }
  }, [localStream, userProfile, getAudioPermission, addCallToHistory, incomingCall]);

  // Simple accept call function
  const acceptCall = useCallback(async (): Promise<void> => {
    if (!incomingCall) return;

    stopNotificationSound();

    try {
      let stream = localStream;
      if (!stream) {
        stream = await getAudioPermission();
        if (!stream) return;
      }

      incomingCall.answer(stream);
      
      // Establish chat connection after answering
      if (!chatConn.current && peerRef.current) {
        const conn = peerRef.current.connect(incomingCall.peer, { label: "chat" });
        chatConn.current = conn;
        setupChatConnection(conn);
      }

      storeAcceptCall();
      console.log('[ACCEPT_CALL] Call accepted');
    } catch (error: any) {
      console.error('[ACCEPT_CALL] Error accepting call:', error);
      setStatus({ type: "error", error: error.message || "Failed to accept call" });
    }
  }, [incomingCall, localStream, getAudioPermission, storeAcceptCall]);

  // Simple reject call function
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    stopNotificationSound();
    incomingCall.close();
    
    if (peerRef.current) {
      peerRef.current.connect(incomingCall.peer, { label: "call_rejected" });
    }
    
    updateCallHistory(incomingCall.peer, { type: 'missed' });
    setIncomingCall(null);
    setStatus({ type: "connected" });
  }, [incomingCall, updateCallHistory]);

  // Simple end call function
  const endCall = useCallback(() => {
    stopNotificationSound();

    if (incomingCall) {
      incomingCall.close();
    }

    if (chatConn.current) {
      chatConn.current.close();
      chatConn.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Clean up audio elements
    const audioElements = document.querySelectorAll('audio[id^="remote-audio"]');
    audioElements.forEach(audio => audio.remove());

    setIncomingCall(null);
    setRemoteStream(null);
    setStatus({ type: "call_ended" });
    
    storeEndCall();

    setTimeout(() => {
      setStatus({ type: "connected" });
    }, 2000);
  }, [incomingCall, localStream, storeEndCall]);

  // Simple chat connection setup
  const setupChatConnection = useCallback((conn: DataConnection) => {
    console.log('[CHAT] Setting up chat connection with:', conn.peer);
    
    conn.on('open', () => {
      console.log('[CHAT] Chat connection opened');
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
        }
      }
    });

    conn.on('close', () => {
      console.log('[CHAT] Chat connection closed');
      if (chatConn.current === conn) {
        chatConn.current = null;
      }
    });

    conn.on('error', (error) => {
      console.error('[CHAT] Chat connection error:', error);
      if (chatConn.current === conn) {
        chatConn.current = null;
      }
    });
  }, []);

  // Simple send chat message
  const sendChatMessage = useCallback((message: string): boolean => {
    if (!chatConn.current || !chatConn.current.open) {
      console.log('[CHAT] Chat connection not ready');
      return false;
    }

    if (!userProfile || !message.trim()) {
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

      // Add to local messages
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

      return true;
    } catch (error) {
      console.error('[CHAT] Failed to send message:', error);
      return false;
    }
  }, [userProfile, myPeerId]);

  // Audio controls
  const toggleAudio = useCallback((): boolean => {
    if (!localStream) return false;
    
    const audioTracks = localStream.getAudioTracks();
    const newState = !audioTracks[0]?.enabled;
    
    audioTracks.forEach(track => {
      track.enabled = newState;
    });
    
    return newState;
  }, [localStream]);

  const toggleVideo = useCallback((): boolean => {
    if (!localStream) return false;
    
    const videoTracks = localStream.getVideoTracks();
    const newState = !videoTracks[0]?.enabled;
    
    videoTracks.forEach(track => {
      track.enabled = newState;
    });
    
    return newState;
  }, [localStream]);

  // Notification sounds
  const playNotificationSound = useCallback(() => {
    if (!userPreferences.soundEnabled) return;

    try {
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
      }

      const audio = new Audio('/ringtone.mp3');
      ringtoneAudioRef.current = audio;
      
      audio.loop = true;
      audio.volume = 0.7;
      audio.play().catch(() => {});
      
      setTimeout(() => {
        if (ringtoneAudioRef.current === audio) {
          audio.pause();
          ringtoneAudioRef.current = null;
        }
      }, 30000);
    } catch (error) {}
  }, [userPreferences.soundEnabled]);

  const stopNotificationSound = useCallback(() => {
    try {
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
        ringtoneAudioRef.current = null;
      }
    } catch (error) {}
  }, []);

  // Check permissions
  const checkMediaPermissions = useCallback(async (): Promise<{
    microphone: PermissionState;
  }> => {
    try {
      if (!navigator.permissions) {
        return { microphone: 'prompt' };
      }

      const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return { microphone: microphonePermission.state };
    } catch (error) {
      return { microphone: 'prompt' };
    }
  }, []);

  // Simple reconnect
  const reconnect = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setStatus({ type: "idle" });
    // Will reinitialize via useEffect
  }, []);

  const initializePeerWithName = useCallback((userName: string) => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setStatus({ type: "connecting" });
    // Will reinitialize via useEffect
  }, []);

  // Main peer initialization effect
  useEffect(() => {
    if (!userProfile?.name || peerRef.current) {
      if (!userProfile?.name) {
        setStatus({ type: "waiting_for_name" });
      }
      return;
    }

    setStatus({ type: "connecting" });

    // Generate peer ID
    const cleanName = userProfile.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const finalName = cleanName || 'user';
    const timestamp = Date.now().toString().slice(-4);
    const customPeerId = `${finalName}_${timestamp}`;

    console.log('[PEER] Initializing peer with ID:', customPeerId);

    const peer = new Peer(customPeerId, PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', (peerId) => {
      console.log('[PEER] Connection established:', peerId);
      setMyPeerId(peerId);
      setStorePeerId(peerId);
      setConnectionStatus('connected');
      setStatus({ type: "connected" });
    });

    peer.on('call', (call) => {
      console.log('[PEER] Incoming call from:', call.peer);
      
      if (incomingCall) {
        call.close();
        return;
      }

      setIncomingCall(call);
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
        type: call.metadata?.callType || 'audio',
      };
      setStoreIncomingCall(incomingCallData);
      
      addCallToHistory({
        peerId: call.peer,
        name: call.metadata?.callerName || 'Unknown Caller',
        type: 'incoming',
        callType: call.metadata?.callType || 'audio',
        timestamp: new Date(),
      });
    });

    peer.on('connection', (conn) => {
      console.log('[PEER] Data connection from:', conn.peer, 'label:', conn.label);
      
      if (conn.label === "call_rejected") {
        conn.close();
        setStatus({ type: "error", error: "Call was declined" });
        return;
      }
      
      if (conn.label === "chat" && !chatConn.current) {
        chatConn.current = conn;
        setupChatConnection(conn);
      }
    });

    peer.on('disconnected', () => {
      console.log('[PEER] Disconnected');
      if (!incomingCall) {
        setStatus({ type: "idle" });
        setConnectionStatus('disconnected');
      }
    });

    peer.on('close', () => {
      console.log('[PEER] Connection closed');
      setStatus({ type: "idle" });
      setConnectionStatus('disconnected');
    });

    peer.on('error', (error) => {
      console.error('[PEER] Error:', error);
      setStatus({ type: "error", error: error.message || "Connection failed" });
      setConnectionStatus('error');
    });

    return () => {
      console.log('[PEER] Cleaning up');
      peer.destroy();
      peerRef.current = null;
    };
  }, [userProfile?.name, incomingCall]);

  // Handle call stream events
  useEffect(() => {
    if (!incomingCall) return;

    const handleStream = (stream: MediaStream) => {
      console.log('[CALL] Received remote stream');
      setRemoteStream(stream);
      setStatus({ type: "in_call", remoteStream: stream });
      
      // Create chat connection if we don't have one
      if (!chatConn.current && peerRef.current) {
        const conn = peerRef.current.connect(incomingCall.peer, { label: "chat" });
        chatConn.current = conn;
        setupChatConnection(conn);
      }

      // Setup audio element
      const audioElements = document.querySelectorAll('audio[id^="remote-audio"]');
      audioElements.forEach(audio => audio.remove());

      const remoteAudio = document.createElement('audio');
      remoteAudio.id = `remote-audio-${Date.now()}`;
      remoteAudio.autoplay = true;
      remoteAudio.volume = 1.0;
      remoteAudio.srcObject = stream;
      document.body.appendChild(remoteAudio);

      remoteAudio.play().catch(() => {
        // If autoplay fails, wait for user interaction
        const enableAudio = () => {
          remoteAudio.play();
          document.removeEventListener('click', enableAudio);
          document.removeEventListener('touchstart', enableAudio);
        };
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('touchstart', enableAudio, { once: true });
      });
    };

    const handleClose = () => {
      console.log('[CALL] Call ended');
      endCall();
    };

    const handleError = (error: any) => {
      console.error('[CALL] Call error:', error);
      setStatus({ type: "error", error: error.message || "Call failed" });
      endCall();
    };

    incomingCall.on('stream', handleStream);
    incomingCall.on('close', handleClose);
    incomingCall.on('error', handleError);

    return () => {
      incomingCall.off('stream', handleStream);
      incomingCall.off('close', handleClose);
      incomingCall.off('error', handleError);
    };
  }, [incomingCall, endCall, setupChatConnection]);

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
    sendChatMessage,
    reconnect,
    initializePeerWithName,
    testRingtone: playNotificationSound,
    stopRingtone: stopNotificationSound,
    checkMediaPermissions,
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
