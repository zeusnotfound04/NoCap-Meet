"use client";
import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import Peer, { DataConnection, MediaConnection } from "peerjs";
import { useMeetingStore } from "@/store/meeting";
import { PEER_CONFIG } from "@/contants";
import { IncomingCall } from "@/types/calling";
import { PeerData } from "@/types/peer";

// ===== TYPES =====

interface PeerStatus {
  type: 
    | "idle"
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
  // Refs
  peer: React.RefObject<Peer | null>;
  chatConn: React.MutableRefObject<DataConnection | null>;
  
  // State
  status: PeerStatus;
  incomingCall: MediaConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  myPeerId: string | null;
  
  // Call Functions
  makeCall: (targetPeerId: string, callType?: 'video' | 'audio') => Promise<boolean>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  
  // Media Functions
  toggleAudio: () => boolean;
  toggleVideo: () => boolean;
  initializeMedia: (constraints?: MediaStreamConstraints) => Promise<MediaStream | null>;
  
  // Chat Functions
  sendChatMessage: (message: string, targetPeerId?: string) => boolean;
  
  // Utility
  reconnect: () => void;
}

// ===== CONTEXT =====

const PeerContext = React.createContext<PeerContextType | undefined>(undefined);

// ===== PROVIDER COMPONENT =====

export const PeerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Refs
  const peerRef = useRef<Peer | null>(null);
  const chatConn = useRef<DataConnection | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  
  // Local state
  const [status, setStatus] = useState<PeerStatus>({ type: "idle" });
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  
  // Call tracking for duration calculation
  const callStartTime = useRef<Date | null>(null);
  const currentCallPeerId = useRef<string | null>(null);
  
  // Store integration
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

  // ===== MEDIA FUNCTIONS =====

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
      console.log('🎥 Nocap-Meet: Requesting media permissions...');
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      // Set local video element safely
      try {
        const localVideo = document.getElementById('local-video') as HTMLVideoElement;
        if (localVideo) {
          localVideo.srcObject = stream;
          localVideo.muted = true;
          localVideo.play().catch(error => {
            console.warn('⚠️ Nocap-Meet: Error playing local video:', error);
          });
        }
      } catch (error) {
        console.warn('⚠️ Nocap-Meet: Error setting local video:', error);
      }
      
      console.log('✅ Nocap-Meet: Media permissions granted');
      return stream;
    } catch (error: any) {
      console.error('❌ Nocap-Meet: Media permission denied:', error);
      setStatus({ type: "error", error: "Camera/microphone access denied" });
      return null;
    }
  }, []);

  const initializeMedia = useCallback(async (
    constraints?: MediaStreamConstraints
  ): Promise<MediaStream | null> => {
    if (localStream) {
      return localStream; // Return existing stream
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

  // ===== CALL FUNCTIONS =====

  const makeCall = useCallback(async (
    targetPeerId: string, 
    callType: 'video' | 'audio' = 'video'
  ): Promise<boolean> => {
    if (!peerRef.current) {
      console.error('❌ Nocap-Meet: Cannot make call - peer not ready');
      setStatus({ type: "error", error: "Connection not ready" });
      return false;
    }

    if (activeCallRef.current || incomingCall) {
      console.error('❌ Nocap-Meet: Already in a call');
      setStatus({ type: "error", error: "Already in a call" });
      return false;
    }

    try {
      console.log(`📞 Nocap-Meet: Starting ${callType} call to ${targetPeerId}`);
      setStatus({ type: "calling_peer" });

      // Get media stream
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

      // Create data connection for chat
      const dataConn = peerRef.current.connect(targetPeerId, { label: "chat" });
      chatConn.current = dataConn;
      setupDataConnection(dataConn);

      // Make the call
      const call = peerRef.current.call(targetPeerId, stream, {
        metadata: {
          callerName: userProfile?.name || 'Unknown',
          callerAvatar: userProfile?.avatar,
          callType,
        }
      });

      activeCallRef.current = call;
      setIncomingCall(call); // Use same ref for consistency
      setupCallEventHandlers(call);

      // Set current call peer ID for tracking
      currentCallPeerId.current = targetPeerId;

      // Add to call history
      await addCallToHistory({
        peerId: targetPeerId,
        name: 'Calling...',
        type: 'outgoing',
        callType,
        timestamp: new Date(),
      });

      console.log('✅ Nocap-Meet: Call initiated');
      return true;
      
    } catch (error: any) {
      console.error('❌ Nocap-Meet: Failed to make call:', error);
      setStatus({ type: "error", error: error.message || "Failed to make call" });
      return false;
    }
  }, [userProfile, getMediaPermissions, addCallToHistory]);

  const acceptCall = useCallback(async (): Promise<void> => {
    if (!incomingCall) {
      console.error('❌ Nocap-Meet: No incoming call to accept');
      return;
    }

    try {
      console.log('✅ Nocap-Meet: Accepting call...');
      
      // Get media stream
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

      // Answer the call
      incomingCall.answer(stream);
      activeCallRef.current = incomingCall;

      // Set current call peer ID for tracking
      currentCallPeerId.current = incomingCall.peer;

      // Establish chat connection if not already exists
      if (!chatConn.current && peerRef.current) {
        const dataConn = peerRef.current.connect(incomingCall.peer, { label: "chat" });
        chatConn.current = dataConn;
        setupDataConnection(dataConn);
      }

      // Update store
      storeAcceptCall();
      setStatus({ type: "in_call" });
      
      console.log('✅ Nocap-Meet: Call accepted');
    } catch (error: any) {
      console.error('❌ Nocap-Meet: Failed to accept call:', error);
      setStatus({ type: "error", error: error.message || "Failed to accept call" });
    }
  }, [incomingCall, localStream, getMediaPermissions, storeAcceptCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    console.log('❌ Nocap-Meet: Rejecting call');
    
    // Close the call
    incomingCall.close();
    
    // Send rejection notice
    if (peerRef.current) {
      const rejectConn = peerRef.current.connect(incomingCall.peer, { label: "call_rejected" });
      rejectConn.on('open', () => {
        rejectConn.close();
      });
    }
    
    // Update call history to show as missed/rejected
    updateCallHistory(incomingCall.peer, { type: 'missed' });
    
    // Reset state
    setIncomingCall(null);
    activeCallRef.current = null;
    setStatus({ type: "connected" });
    
    console.log('✅ Nocap-Meet: Call rejected');
  }, [incomingCall, updateCallHistory]);

  const endCall = useCallback(() => {
    console.log('📞 Nocap-Meet: Ending call');

    // Close active call
    if (activeCallRef.current) {
      activeCallRef.current.close();
      activeCallRef.current = null;
    }

    // Close incoming call if exists
    if (incomingCall && incomingCall !== activeCallRef.current) {
      incomingCall.close();
    }

    // Close chat connection
    if (chatConn.current) {
      chatConn.current.close();
      chatConn.current = null;
    }

    // Stop media streams
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🎤📹 Nocap-Meet: Stopped track:', track.kind);
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
      console.warn('⚠️ Nocap-Meet: Error clearing video elements:', error);
    }

    // Reset state
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
        setCallConnected(); // Update store with call start time
        
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
      console.log('Chat connection opened');
    });

    conn.on('data', (data: unknown) => {
      console.log('Received chat data:', data);
      
      if (typeof data === 'object' && data !== null && 'type' in data) {
        const peerData = data as PeerData;
        console.log('✅ Nocap-Meet: Valid peer data received:', peerData);
        // TODO: Add chat message handling logic here
      } else {
        console.warn('⚠️ Nocap-Meet: Received invalid chat data format:', data);
      }
    });

    conn.on('close', () => {
      console.log('📡 Nocap-Meet: Chat connection closed');
    });

    conn.on('error', (error: any) => {
      console.error('❌ Nocap-Meet: Chat connection error:', error);
    });
  }, []);


  const sendChatMessage = useCallback((message: string, targetPeerId?: string): boolean => {
    if (!chatConn.current || !chatConn.current.open) {
      console.warn('⚠️ Nocap-Meet: No active chat connection');
      return false;
    }

    if (!userProfile) {
      console.warn('⚠️ Nocap-Meet: No user profile for chat');
      return false;
    }

    const chatData: PeerData = {
      type: 'chat',
      payload: {
        message,
        senderName: userProfile.name,
      },
      timestamp: new Date(),
      senderId: myPeerId || '',
    };

    try {
      chatConn.current.send(chatData);
      console.log('💬 Nocap-Meet: Chat message sent');
      return true;
    } catch (error) {
      console.error('❌ Nocap-Meet: Failed to send chat message:', error);
      return false;
    }
  }, [userProfile, myPeerId]);


  const initializePeer = useCallback(() => {
    console.log('Initializing peer connection...');
    setStatus({ type: "connecting" });

    const peer = new Peer(PEER_CONFIG);
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
      console.log('📡 Nocap-Meet: Data connection from:', conn.peer);
      
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
      console.log('🔒 Nocap-Meet: Peer connection closed');
      setStatus({ type: "idle" });
      setConnectionStatus('disconnected');
    });

    peer.on('error', (error: any) => {
      console.error('❌ Nocap-Meet: Peer error:', error);
      setStatus({ type: "error", error: error.message || "Connection failed" });
      setConnectionStatus('error');
    });

  }, [setStorePeerId, setConnectionStatus, setStoreIncomingCall, userPreferences.soundEnabled]);

  const reconnect = useCallback(() => {
    console.log('🔄 Nocap-Meet: Reconnecting...');
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    
    setStatus({ type: "idle" });
    setTimeout(initializePeer, 1000);
  }, [initializePeer]);

  useEffect(() => {
    console.log('🎯 Nocap-Meet: Context mounted, initializing peer...');
    initializePeer();
    
    return () => {
      console.log('🧹 Nocap-Meet: Context unmounting, cleaning up...');
      
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
      
      setStatus({ type: "idle" });
    };
  }, []); 


  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/meeting-sounds/notification.mp3');
      audio.loop = true;
      audio.play().catch(console.warn);
      
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, 30000);
    } catch (error) {
      console.warn('  Could not play notification:', error);
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