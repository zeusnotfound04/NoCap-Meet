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
  checkMediaPermissions: () => Promise<{
    microphone: PermissionState;
  }>;
}


const PeerContext = React.createContext<PeerContextType | undefined>(undefined);

export const PeerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const peerRef = useRef<Peer | null>(null);
  const chatConn = useRef<DataConnection | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const initializingRef = useRef<boolean>(false);
  
  const [status, setStatus] = useState<PeerStatus>({ type: "waiting_for_name" });
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  
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
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false 
    }
  ): Promise<MediaStream | null> => {
    try {
      setStatus({ type: "permission" });
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus({ type: "error", error: "Microphone not supported in this browser" });
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = true;
      });
      
      setLocalStream(stream);
      
      return stream;
      
    } catch (error: any) {
      
      let errorMessage = "Microphone access denied";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Please allow microphone access and try again";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No microphone found";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Microphone is already in use by another application";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "Microphone constraints cannot be satisfied";
      } else if (error.name === 'SecurityError') {
        errorMessage = "Microphone access blocked due to security policy";
      }
      
      setStatus({ type: "error", error: errorMessage });
      return null;
    }
  }, []);

  const initializeMedia = useCallback(async (
    constraints?: MediaStreamConstraints
  ): Promise<MediaStream | null> => {
    if (localStream) {
      return localStream;
    }
    
    const fallbackConstraints: MediaStreamConstraints[] = [
      constraints || {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      },
      {
        audio: {
          echoCancellation: true,
        },
        video: false
      },
      {
        audio: true,
        video: false
      },
      {
        audio: {},
        video: false
      }
    ];
    
    for (let i = 0; i < fallbackConstraints.length; i++) {
      const currentConstraints = fallbackConstraints[i];
      
      try {
        const stream = await getMediaPermissions(currentConstraints);
        if (stream) {
          return stream;
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
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
    callType: 'video' | 'audio' = 'audio'
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

      const permissions = await checkMediaPermissions();
      
      if (permissions.microphone === 'denied') {
        setStatus({ 
          type: "error", 
          error: "Microphone permission denied. Please allow microphone access in your browser settings and refresh the page." 
        });
        return false;
      }

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      };
      
      const stream = await initializeMedia(constraints);
      if (!stream) {
        setStatus({ 
          type: "error", 
          error: "Failed to access microphone. Please check your device and browser permissions." 
        });
        return false;
      }

      console.log('[MAKE_CALL] Initiating call with stream (chat connection will be established after call connects):', {
        targetPeerId,
        audioTracks: stream.getAudioTracks().length,
        metadata: {
          callerName: userProfile?.name || 'Unknown',
          callerAvatar: userProfile?.avatar,
          callType,
        }
      });

      const call = peerRef.current.call(targetPeerId, stream, {
        metadata: {
          callerName: userProfile?.name || 'Unknown',
          callerAvatar: userProfile?.avatar,
          callType,
        }
      });

      activeCallRef.current = call;
      // Don't set incomingCall for outgoing calls - this is the root cause of the issue
      setupCallEventHandlers(call);
      
      // Resume AudioContext when making a call
      try {
        if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('[MAKE_CALL] AudioContext state:', audioContext.state);
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('[MAKE_CALL] AudioContext resumed successfully');
          }
        }
      } catch (error) {
        console.warn('[MAKE_CALL] Failed to resume AudioContext:', error);
      }

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
  }, [userProfile, initializeMedia, addCallToHistory]);

  const acceptCall = useCallback(async (): Promise<void> => {
    if (!incomingCall) {
      return;
    }

    stopNotificationSound();

    try {
      let stream = localStream;
      if (!stream) {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false
        };
        stream = await getMediaPermissions(constraints);
        if (!stream) return;
      }

      incomingCall.answer(stream);
      activeCallRef.current = incomingCall;
      
      // Resume AudioContext immediately when accepting call
      try {
        if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('[ACCEPT_CALL] AudioContext state:', audioContext.state);
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('[ACCEPT_CALL] AudioContext resumed successfully');
          }
        }
      } catch (error) {
        console.warn('[ACCEPT_CALL] Failed to resume AudioContext:', error);
      }

      currentCallPeerId.current = incomingCall.peer;

      storeAcceptCall();
      setStatus({ type: "in_call" });
      console.log('[ACCEPT_CALL] Call accepted, status set to in_call');
      
      // Don't clear incomingCall here - let it be managed in the call event handlers
      
    } catch (error: any) {
      console.error('[ACCEPT_CALL] Error accepting call:', error);
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

    // Only close incomingCall if it exists and is different from activeCall
    if (incomingCall) {
      incomingCall.close();
      setIncomingCall(null);
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
      const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;
      if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.remove();
      }
    } catch (error) {
    }

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
    console.log('[SETUP_CALL_HANDLERS] Setting up event handlers for call:', {
      callId: call.peer,
      isIncoming: !!incomingCall,
      currentStatus: status.type
    });

    call.on('stream', (stream: MediaStream) => {
      console.log('[CALL_STREAM] Received remote stream:', {
        streamId: stream.id,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
        callPeer: call.peer
      });
      
      setRemoteStream(stream);
      setStatus({ type: "in_call", remoteStream: stream });
      
      // Establish chat connection after stream is received and stable
      if (!chatConn.current && peerRef.current) {
        console.log('[CALL_STREAM] Establishing chat connection after stream received');
        setTimeout(() => {
          try {
            const dataConn = peerRef.current!.connect(call.peer, { label: "chat" });
            chatConn.current = dataConn;
            setupDataConnection(dataConn);
          } catch (error) {
            console.warn('[CALL_STREAM] Failed to establish chat connection:', error);
          }
        }, 1000); // Wait 1 second after stream is received
      }
      
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
      
      // Resume AudioContext when receiving stream
      const resumeAudioContext = async () => {
        try {
          if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            console.log('[CALL_STREAM] AudioContext state:', audioContext.state);
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
              console.log('[CALL_STREAM] AudioContext resumed successfully');
            }
          }
        } catch (ctxError) {
          console.warn('[CALL_STREAM] AudioContext resume failed:', ctxError);
        }
      };
      
      // Resume audio context immediately
      resumeAudioContext();
      
      try {
        const audioTracks = stream.getAudioTracks();
        console.log('[AUDIO_DEBUG] Setting up remote audio stream', {
          audioTracksCount: audioTracks.length,
          streamId: stream.id,
          tracksEnabled: audioTracks.map(t => t.enabled),
          callPeer: call.peer
        });
        
        // Remove any existing remote audio elements
        const existingAudio = document.getElementById('remote-audio') as HTMLAudioElement;
        if (existingAudio) {
          console.log('[AUDIO_DEBUG] Removing existing remote audio element');
          existingAudio.srcObject = null;
          existingAudio.remove();
        }
        
        // Only proceed if we have audio tracks
        if (audioTracks.length === 0) {
          console.warn('[AUDIO_DEBUG] No audio tracks in remote stream');
          return;
        }
        
        const remoteAudio = document.createElement('audio');
        remoteAudio.id = 'remote-audio';
        remoteAudio.autoplay = true;
        remoteAudio.controls = false;
        remoteAudio.volume = 1.0;
        remoteAudio.muted = false;
        
        remoteAudio.addEventListener('loadstart', () => console.log('[AUDIO_DEBUG] Audio load start'));
        remoteAudio.addEventListener('canplay', () => console.log('[AUDIO_DEBUG] Audio can play'));
        remoteAudio.addEventListener('playing', () => console.log('[AUDIO_DEBUG] Audio playing'));
        remoteAudio.addEventListener('pause', () => console.log('[AUDIO_DEBUG] Audio paused'));
        remoteAudio.addEventListener('error', (e) => console.error('[AUDIO_DEBUG] Audio error:', e));
        
        document.body.appendChild(remoteAudio);
        remoteAudio.srcObject = stream;
        
        const playAudio = async () => {
          try {
            // Resume AudioContext before playing
            await resumeAudioContext();
            await remoteAudio.play();
            console.log('[AUDIO_DEBUG] Audio playback started successfully');
          } catch (playError) {
            console.warn('[AUDIO_DEBUG] Auto-play failed, will try on user interaction:', playError);
            
            const enableAudioOnClick = async () => {
              try {
                await resumeAudioContext();
                await remoteAudio.play();
                console.log('[AUDIO_DEBUG] Audio enabled after user interaction');
              } catch (err) {
                console.error('[AUDIO_DEBUG] Failed to play audio after interaction:', err);
              }
            };
            
            document.addEventListener('click', enableAudioOnClick, { once: true });
            document.addEventListener('touchstart', enableAudioOnClick, { once: true });
          }
        };
        
        // Small delay to ensure audio element is ready
        setTimeout(playAudio, 100);
        
      } catch (error) {
        console.error('[AUDIO_DEBUG] Failed to set up remote audio:', error);
      }
    });

    call.on('close', () => {
      console.log('[CALL_EVENT] Call closed');
      endCall();
    });

    call.on('error', (error: any) => {
      console.error('[CALL_EVENT] Call error:', error);
      setStatus({ type: "error", error: error.message || "Call failed" });
      endCall();
    });
  }, [endCall, contacts, updateCallHistory, setCallConnected, status.type, incomingCall]);

  const setupDataConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      console.log('[DATA_CONN] Data connection opened with peer:', conn.peer);
    });

    conn.on('data', (data: unknown) => {
      console.log('[DATA_RECEIVED] Received data:', data);
      
      if (typeof data === 'object' && data !== null && 'type' in data) {
        const peerData = data as PeerData;
        
        if (peerData.type === 'chat' && peerData.payload?.message) {
          console.log('[CHAT_RECEIVE] Processing chat message:', peerData);
          
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
          console.log('[CHAT_RECEIVE] Message added to store');
        }
      }
    });

    conn.on('close', () => {
      console.log('[DATA_CONN] Data connection closed with peer:', conn.peer);
      // Don't reset chatConn.current here as it might be needed for the call
    });

    conn.on('error', (error: any) => {
      console.error('[DATA_CONN] Data connection error:', error);
      // Only reset chatConn.current if this is the current connection
      if (chatConn.current === conn) {
        chatConn.current = null;
      }
    });
  }, []);


  const sendChatMessage = useCallback((message: string, targetPeerId?: string): boolean => {
    console.log('[CHAT_SEND] Attempting to send message:', {
      hasConnection: !!chatConn.current,
      connectionOpen: chatConn.current?.open,
      hasUserProfile: !!userProfile,
      messageLength: message?.length,
      peerId: myPeerId,
      currentCallPeer: currentCallPeerId.current
    });

    if (!userProfile) {
      console.error('[CHAT_SEND] No user profile available');
      return false;
    }

    if (!message.trim()) {
      console.error('[CHAT_SEND] Empty message');
      return false;
    }

    // If we don't have a chat connection but we're in a call, try to establish one
    if ((!chatConn.current || !chatConn.current.open) && currentCallPeerId.current && peerRef.current) {
      console.log('[CHAT_SEND] No chat connection, attempting to establish one');
      try {
        const dataConn = peerRef.current.connect(currentCallPeerId.current, { label: "chat" });
        chatConn.current = dataConn;
        setupDataConnection(dataConn);
        
        // Return false immediately and let user try again after connection is established
        console.log('[CHAT_SEND] Chat connection being established, please try sending message again in a moment');
        return false;
      } catch (error) {
        console.error('[CHAT_SEND] Failed to establish chat connection:', error);
        return false;
      }
    }

    if (!chatConn.current || !chatConn.current.open) {
      console.error('[CHAT_SEND] No chat connection available');
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

      console.log('[CHAT_SEND] Sending chat data:', chatData);
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
      console.log('[CHAT_SEND] Message sent successfully');

      return true;
    } catch (error) {
      console.error('[CHAT_SEND] Failed to send message:', error);
      return false;
    }
  }, [userProfile, myPeerId, setupDataConnection]);


  const createPeerWithRetry = useCallback((customPeerId: string, attempt: number = 0): Promise<Peer> => {
    return new Promise((resolve, reject) => {
      if (attempt > 0) {
        setIsRetrying(true);
        const retryMessage = `Retrying connection... (${attempt}/${maxConnectionAttempts})`;
        setStatus({ type: "connecting", error: retryMessage });
      }

      const peer = new Peer(customPeerId, PEER_CONFIG);
      
      const timeoutDuration = 8000 + (attempt * 4000);
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
    if (initializingRef.current) {
      return;
    }

    if (peerRef.current && !peerRef.current.disconnected && !peerRef.current.destroyed) {
      return;
    }

    initializingRef.current = true;

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

    const testServerConnectivity = async (): Promise<void> => {
      const protocol = PEER_CONFIG.secure ? 'https' : 'http';
      const serverUrl = `${protocol}://${PEER_CONFIG.host}:${PEER_CONFIG.port}${PEER_CONFIG.path}`;
      
      try {
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 5000);
        
        const response = await fetch(serverUrl, { 
          method: 'GET', 
          mode: 'no-cors',
          signal: abortController.signal
        });
        
        clearTimeout(timeout);
      } catch (error) {
      }
    };

    testServerConnectivity();

    createPeerWithRetry(customPeerId)
      .then((peer) => {
        initializingRef.current = false;
        peerRef.current = peer;
        const peerId = peer.id;
        
        console.log('[PEER_SUCCESS] Peer connection established successfully:', {
          peerId,
          host: PEER_CONFIG.host,
          port: PEER_CONFIG.port,
          secure: PEER_CONFIG.secure,
          environment: process.env.NODE_ENV
        });
        
        setMyPeerId(peerId);
        setStorePeerId(peerId);
        setConnectionStatus('connected');
        setStatus({ type: "connected" });

        peer.on('call', (call) => {
          console.log('[CALL_DEBUG] Incoming call received:', {
            from: call.peer,
            metadata: call.metadata,
            hasActiveCall: !!activeCallRef.current,
            hasIncomingCall: !!incomingCall
          });

          if (activeCallRef.current || incomingCall) {
            console.log('[CALL_DEBUG] Rejecting call - already busy');
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
          console.log('[DATA_DEBUG] Data connection established:', {
            peer: conn.peer,
            label: conn.label,
            open: conn.open
          });
          
          if (conn.label === "call_rejected") {
            console.log('[DATA_DEBUG] Call rejected by remote peer');
            conn.close();
            setStatus({ type: "error", error: "Call was declined" });
            return;
          }
          
          if (conn.label === "chat") {
            console.log('[CHAT_DEBUG] Chat connection established with peer:', conn.peer);
            chatConn.current = conn;
            setupDataConnection(conn);
          }
        });

        peer.on('disconnected', () => {
          if (activeCallRef.current || incomingCall) {
            return;
          }
          
          setStatus({ type: "idle" });
          setConnectionStatus('disconnected');
          
          setTimeout(() => {
            if (!peerRef.current || peerRef.current.disconnected) {
              initializePeer(customName);
            }
          }, 3000);
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
        initializingRef.current = false;
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
    if (userProfile?.name && !peerRef.current) {
      console.log('[PEER_LIFECYCLE] Initializing peer for first time');
      initializePeer(userProfile.name);
    } else if (!userProfile?.name) {
      setStatus({ type: "waiting_for_name" });
    }
    
    return () => {
      console.log('[PEER_LIFECYCLE] Component unmounting - cleaning up');
      
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
          console.log('[PEER_LIFECYCLE] Destroying peer connection');
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
  }, [userProfile?.name]); // Remove initializePeer from dependency array 


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

  const checkMediaPermissions = useCallback(async (): Promise<{
    microphone: PermissionState;
  }> => {
    try {
      if (!navigator.permissions) {
        return { microphone: 'prompt' };
      }

      const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });

      return {
        microphone: microphonePermission.state
      };
    } catch (error) {
      return { microphone: 'prompt' };
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