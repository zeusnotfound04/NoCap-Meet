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
  
  // Connection retry state
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [maxConnectionAttempts] = useState(2);
  const [isRetrying, setIsRetrying] = useState(false);
  
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
          localVideo.play().catch(error => {});
        }
      } catch (error) {}
      
      return stream;
    } catch (error: any) {
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


  const makeCall = useCallback(async (
    targetPeerId: string, 
    callType: 'video' | 'audio' = 'video'
  ): Promise<boolean> => {
    if (!peerRef.current) {
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
      setStatus({ type: "error", error: error.message || "Failed to make call" });
      return false;
    }
  }, [userProfile, getMediaPermissions, addCallToHistory]);

  const acceptCall = useCallback(async (): Promise<void> => {
    if (!incomingCall) {
      return;
    }

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
      setStatus({ type: "error", error: error.message || "Failed to accept call" });
    }
  }, [incomingCall, localStream, getMediaPermissions, storeAcceptCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

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
    } catch (error) {}

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
      setRemoteStream(stream);
      setStatus({ type: "in_call", remoteStream: stream });
      
      if (!callStartTime.current) {
        callStartTime.current = new Date();
        setCallConnected();
        
        if (currentCallPeerId.current) {
          const contact = contacts.find(c => c.peerId === currentCallPeerId.current);
          if (contact) {
            updateCallHistory(currentCallPeerId.current, { name: contact.name });
          }
        }
      }
      
      try {
        const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement;
        if (remoteVideo) {
          remoteVideo.srcObject = stream;
          remoteVideo.play().catch(error => {});
        }
      } catch (error) {}
    });

    call.on('close', () => {
      endCall();
    });

    call.on('error', (error: any) => {
      setStatus({ type: "error", error: error.message || "Call failed" });
      endCall();
    });
  }, [endCall, contacts, updateCallHistory, setCallConnected]);

  const setupDataConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {});

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

    conn.on('close', () => {});

    conn.on('error', (error: any) => {});
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

      return true;
    } catch (error) {
      return false;
    }
  }, [userProfile, myPeerId]);


  const createPeerWithRetry = useCallback((customPeerId: string, attempt: number = 0): Promise<Peer> => {
    return new Promise((resolve, reject) => {
      if (attempt > 0) {
        setIsRetrying(true);
        const retryMessage = `Retrying connection... (${attempt}/${maxConnectionAttempts})`;
        setStatus({ type: "connecting", error: retryMessage });
      }

      console.log(`🔄 [PEER_DEBUG] Attempt ${attempt + 1}: Using config:`, {
        host: PEER_CONFIG.host,
        port: PEER_CONFIG.port,
        secure: PEER_CONFIG.secure,
        fullUrl: `${PEER_CONFIG.secure ? 'wss' : 'ws'}://${PEER_CONFIG.host}:${PEER_CONFIG.port}${PEER_CONFIG.path}`
      });

      const peer = new Peer(customPeerId, PEER_CONFIG);
      
      // Increase timeout for each attempt
      const timeoutDuration = 8000 + (attempt * 4000); // 8s, 12s, 16s
      const connectionTimeout = setTimeout(() => {
        peer.destroy();
        
        if (attempt < maxConnectionAttempts) {
          const timestamp = Date.now().toString().slice(-4);
          const randomSuffix = Math.floor(Math.random() * 999) + 100;
          const userName = customPeerId.split('_')[0] || 'user';
          const newPeerId = `${userName}_${timestamp}_${randomSuffix}`;
          
          setTimeout(() => {
            createPeerWithRetry(newPeerId, attempt + 1)
              .then(resolve)
              .catch(reject);
          }, 2000);
        } else {
          const timeoutError = new Error('Connection timeout after all attempts');
          reject(timeoutError);
        }
      }, timeoutDuration);

      peer.on('open', (peerId) => {
        clearTimeout(connectionTimeout);
        setIsRetrying(false);
        setConnectionAttempts(0);
        resolve(peer);
      });

      peer.on('error', (error: any) => {
        clearTimeout(connectionTimeout);

        if (error.type === 'unavailable-id') {
          const timestamp = Date.now().toString().slice(-4);
          const randomSuffix = Math.floor(Math.random() * 999) + 100;
          const userName = customPeerId.split('_')[0] || 'user';
          const newPeerId = `${userName}_${timestamp}_${randomSuffix}`;
          
          createPeerWithRetry(newPeerId, attempt)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (attempt < maxConnectionAttempts) {
          setTimeout(() => {
            const timestamp = Date.now().toString().slice(-4);
            const randomSuffix = Math.floor(Math.random() * 999) + 100;
            const userName = customPeerId.split('_')[0] || 'user';
            const newPeerId = `${userName}_${timestamp}_${randomSuffix}`;
            
            createPeerWithRetry(newPeerId, attempt + 1)
              .then(resolve)
              .catch(reject);
          }, 3000); // Wait 3 seconds before retry
        } else {
          reject(error);
        }
      });
    });
  }, [maxConnectionAttempts]);

  const initializePeer = useCallback((customName?: string) => {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (error) {
        console.error('Error destroying existing peer:', error);
      }
      peerRef.current = null;
    }

    setStatus({ type: "connecting" });
    setConnectionAttempts(0);
    setIsRetrying(false);

    const generateCustomPeerId = (): string => {
      const userName = customName || userProfile?.name;
      
      if (!userName || userName.trim() === '') {
        const threeDayNumber = getThreeDayBasedNumber();
        const peerId = `user_${threeDayNumber}`;
        return peerId;
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

    // Test server connectivity first
    const testServerConnectivity = async (): Promise<void> => {
      console.log('🔍 [PEER_DEBUG] Testing server connectivity...');
      
      const protocol = PEER_CONFIG.secure ? 'https' : 'http';
      const serverUrl = `${protocol}://${PEER_CONFIG.host}:${PEER_CONFIG.port}${PEER_CONFIG.path}`;
      
      try {
        console.log(`🌐 [PEER_DEBUG] Testing: ${serverUrl}`);
        
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 5000);
        
        const response = await fetch(serverUrl, { 
          method: 'GET', 
          mode: 'no-cors',
          signal: abortController.signal
        });
        
        clearTimeout(timeout);
        console.log(`✅ [PEER_DEBUG] Server reachable: ${serverUrl}`);
      } catch (error) {
        console.warn(`❌ [PEER_DEBUG] Server unreachable: ${serverUrl}`, error);
      }
    };

    testServerConnectivity();

    // Use the retry mechanism
    createPeerWithRetry(customPeerId)
      .then((peer) => {
        peerRef.current = peer;
        const peerId = peer.id;
        
        setMyPeerId(peerId);
        setStorePeerId(peerId);
        setConnectionStatus('connected');
        setStatus({ type: "connected" });

        // Setup event handlers for the successfully connected peer
        peer.on('call', (call) => {
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
         
          setStatus({ type: "idle" });
          setConnectionStatus('disconnected');
        });

        peer.on('close', () => {
        
          setStatus({ type: "idle" });
          setConnectionStatus('disconnected');
        });

        peer.on('error', (error: any) => {
         
          setStatus({ type: "error", error: error.message || "Connection failed" });
          setConnectionStatus('error');
        });

       
      })
      .catch((error) => {
      
        setIsRetrying(false);
        setStatus({ type: "error", error: error.message || "Connection failed after all attempts" });
        setConnectionStatus('error');
      });

  }, [setStorePeerId, setConnectionStatus, setStoreIncomingCall, userPreferences.soundEnabled, setupCallEventHandlers, addCallToHistory, createPeerWithRetry]);

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
          } catch (error) {}
        });
      }
      
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
          peerRef.current = null;
        } catch (error) {}
      }
      
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
      return;
    }

    try {
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
      }

      const audio = new Audio('/ringtone.mp3');
      ringtoneAudioRef.current = audio;
      
      audio.loop = true;
      audio.volume = 0.7;
      
      audio.addEventListener('canplaythrough', () => {});
      
      audio.addEventListener('play', () => {});
      
      audio.addEventListener('error', (e) => {});
      
      audio.play().catch(error => {});
      
      setTimeout(() => {
        if (ringtoneAudioRef.current === audio) {
          audio.pause();
          audio.currentTime = 0;
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