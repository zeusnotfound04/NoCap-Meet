import { useEffect, useRef, useCallback, useState } from 'react';
import { MediaConnection } from 'peerjs';
import { PeerManager } from '@/lib/peer';
import { useMeetingStore } from '@/store/meeting';
import { IncomingCall } from '@/types/calling';
import { PeerData } from '@/types/peer';
import { generateUserId } from '@/lib/utils';

export function usePeerConnection() {
  const peerManagerRef = useRef<PeerManager | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    setMyPeerId,
    setConnectionStatus,
    setIncomingCall,
    acceptCall,
    endCall,
    setActiveMediaCall,
    setLocalStream,
    callState,
    userProfile,
    addMessage,
    userPreferences,
    updateCallDuration,
  } = useMeetingStore();

  
  useEffect(() => {
    if (!peerManagerRef.current) {
      initializePeerManager();
    }

    return () => {
      cleanup();
    };
  }, []);

  const initializePeerManager = useCallback(() => {
    try {
      const peerManager = new PeerManager();
      peerManagerRef.current = peerManager;

      peerManager.setEventHandlers({
        onOpen: handlePeerOpen,
        onCall: handleIncomingCall,
        onConnection: handleDataConnection,
        onData: handleDataReceived,
        onStream: handleRemoteStream,
        onClose: handleCallClosed,
        onError: handlePeerError,
        onDisconnected: handlePeerDisconnected,
      });

      setIsInitialized(true);
      setError(null);
      console.log(' PeerJS manager initialized');
    } catch (error) {
      console.error(' Failed to initialize peer manager:', error);
      setError('Failed to initialize peer connection');
    }
  }, []);


  const handlePeerOpen = useCallback((peerId: string) => {
    console.log('🔗 Peer connected with ID:', peerId);
    setMyPeerId(peerId);
    setConnectionStatus('connected');
  }, [setMyPeerId, setConnectionStatus]);

  const handleIncomingCall = useCallback((call: MediaConnection) => {
    if (!userProfile) {
      console.warn('⚠️ No user profile, rejecting call');
      call.close();
      return;
    }

    if (callState.isInCall) {
      console.log(' Already in call, rejecting incoming call');
      call.close();
      return;
    }

    const incomingCall: IncomingCall = {
      callId: `call-${Date.now()}`,
      callerPeerId: call.peer,
      callerName: call.metadata?.callerName || 'Unknown',
      callerAvatar: call.metadata?.callerAvatar,
      timestamp: new Date(),
      type: call.metadata?.callType || 'video',
    };

    setActiveMediaCall(call);
    setIncomingCall(incomingCall);

    // Play ringtone if enabled
    if (userPreferences.soundEnabled) {
      playRingtone();
    }

    console.log('📞 Incoming call from:', call.peer);
  }, [userProfile, callState.isInCall, setActiveMediaCall, setIncomingCall, userPreferences.soundEnabled]);

  const handleDataConnection = useCallback((conn: any) => {
    console.log('📡 Data connection established with:', conn.peer);
  }, []);

  const handleDataReceived = useCallback((data: PeerData, peerId: string) => {
    console.log('📨 Received data from:', peerId, data);

    switch (data.type) {
      case 'chat':
        addMessage({
          id: `msg-${Date.now()}`,
          senderId: peerId,
          senderName: data.payload.senderName || 'Unknown',
          message: data.payload.message,
          timestamp: new Date(data.timestamp),
          type: 'text',
        });
        break;

      case 'system':
        console.log(' System message:', data.payload);
        break;

      case 'media-control':
        handleRemoteMediaControl(data.payload, peerId);
        break;

      default:
        console.log(' Unknown data type:', data.type);
    }
  }, [addMessage]);

  const handleRemoteStream = useCallback((stream: MediaStream, peerId: string) => {
    console.log('📺 Received remote stream from:', peerId);
    const videoElement = document.getElementById(`remote-video-${peerId}`) as HTMLVideoElement;
    if (videoElement) {
      videoElement.srcObject = stream;
    } else {
      const fallbackVideo = document.getElementById('remote-video') as HTMLVideoElement;
      if (fallbackVideo) {
        fallbackVideo.srcObject = stream;
      }
    }
  }, []);

  const handleCallClosed = useCallback((peerId: string) => {
    console.log(' Call closed with:', peerId);
    endCall();
  }, [endCall]);

  const handlePeerError = useCallback((error: Error) => {
    console.error(' Peer error:', error);
    setError(error.message);
    setConnectionStatus('error');
  }, [setConnectionStatus]);

  const handlePeerDisconnected = useCallback(() => {
    console.log('🔌 Peer disconnected');
    setConnectionStatus('disconnected');
  }, [setConnectionStatus]);

  const handleRemoteMediaControl = useCallback((payload: any, peerId: string) => {
    console.log(`🎛️ Remote media control from ${peerId}:`, payload);
  }, []);


  const initializeMedia = useCallback(async (
    constraints: MediaStreamConstraints = { video: true, audio: true }
  ): Promise<MediaStream | null> => {
    if (!peerManagerRef.current) return null;

    try {
      const stream = await peerManagerRef.current.getLocalStream(constraints);
      setLocalStream(stream);

      const localVideo = document.getElementById('local-video') as HTMLVideoElement;
      if (localVideo) {
        localVideo.srcObject = stream;
      }

      console.log('📹 Local media initialized');
      return stream;
    } catch (error) {
      console.error(' Failed to initialize media:', error);
      setError('Failed to access camera/microphone');
      return null;
    }
  }, [setLocalStream]);

  const toggleAudio = useCallback(() => {
    if (!peerManagerRef.current) return false;
    
    const newState = peerManagerRef.current.toggleAudio();
    
    broadcastMediaControl('audio', newState);
    
    return newState;
  }, []);

  const toggleVideo = useCallback(() => {
    if (!peerManagerRef.current) return false;
    
    const newState = peerManagerRef.current.toggleVideo();
    
    broadcastMediaControl('video', newState);
    
    return newState;
  }, []);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    if (!peerManagerRef.current) return null;

    try {
      const screenStream = await peerManagerRef.current.getScreenShare();
      
      const activeCalls = peerManagerRef.current.getActiveCalls();
      activeCalls.forEach(peerId => {
        replaceVideoTrack(peerId, screenStream);
      });

      console.log(' Screen sharing started');
      return screenStream;
    } catch (error) {
      console.error(' Failed to start screen share:', error);
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(async (): Promise<void> => {
    if (!peerManagerRef.current) return;

    peerManagerRef.current.stopScreenShare();

    const localStream = peerManagerRef.current.getLocalStream_Current();
    if (localStream) {
      const activeCalls = peerManagerRef.current.getActiveCalls();
      activeCalls.forEach(peerId => {
        replaceVideoTrack(peerId, localStream);
      });
    }

    console.log(' Screen sharing stopped');
  }, []);


  const makeCall = useCallback(async (
    targetPeerId: string, 
    callType: 'video' | 'audio' = 'video'
  ): Promise<boolean> => {
    if (!peerManagerRef.current || !userProfile) {
      console.error(' Cannot make call: peer manager or user profile not ready');
      return false;
    }

    try {
      let stream = peerManagerRef.current.getLocalStream_Current();
      if (!stream) {
        const constraints = {
          video: callType === 'video',
          audio: true
        };
        stream = await initializeMedia(constraints);
        if (!stream) return false;
      }

      const dataConn = peerManagerRef.current.connectToPeer(targetPeerId, {
        callerName: userProfile.name,
        callerAvatar: userProfile.avatar,
      });

      setTimeout(() => {
        if (dataConn.open) {
          const callData: PeerData = {
            type: 'system',
            payload: {
              action: 'call-request',
              callType,
              callerName: userProfile.name,
              callerAvatar: userProfile.avatar,
            },
            timestamp: new Date(),
            senderId: peerManagerRef.current!.getPeerId() || '',
          };
          dataConn.send(callData);
        }
      }, 1000);

      const call = await peerManagerRef.current.makeCall(targetPeerId, stream, {
        callerName: userProfile.name,
        callerAvatar: userProfile.avatar,
        callType,
      });

      setActiveMediaCall(call);
      console.log(` Call initiated to ${targetPeerId}`);
      return true;
    } catch (error) {
      console.error(' Failed to make call:', error);
      setError('Failed to make call');
      return false;
    }
  }, [userProfile, initializeMedia, setActiveMediaCall]);

  const answerCall = useCallback(async (): Promise<boolean> => {
    if (!peerManagerRef.current || !callState.currentCall) {
      console.error(' Cannot answer call: no active incoming call');
      return false;
    }

    try {
      const activeCall = peerManagerRef.current; 
      
      const constraints = {
        video: callState.currentCall.type === 'video',
        audio: true
      };
      const stream = await initializeMedia(constraints);
      if (!stream) return false;

      console.log('✅ Call answered');
      acceptCall();
      return true;
    } catch (error) {
      console.error('❌ Failed to answer call:', error);
      setError('Failed to answer call');
      return false;
    }
  }, [callState.currentCall, initializeMedia, acceptCall]);

  const hangupCall = useCallback((peerId?: string) => {
    if (!peerManagerRef.current) return;

    if (peerId) {
      peerManagerRef.current.hangupCall(peerId);
    } else {
      peerManagerRef.current.hangupAllCalls();
    }

    endCall();
    console.log('📞 Call ended');
  }, [endCall]);


  const sendChatMessage = useCallback((message: string, targetPeerId?: string) => {
    if (!peerManagerRef.current || !userProfile) return false;

    const chatData: PeerData = {
      type: 'chat',
      payload: {
        message,
        senderName: userProfile.name,
      },
      timestamp: new Date(),
      senderId: peerManagerRef.current.getPeerId() || '',
    };

    if (targetPeerId) {
      return peerManagerRef.current.sendData(targetPeerId, chatData);
    } else {
      peerManagerRef.current.broadcastData(chatData);
      return true;
    }
  }, [userProfile]);

  const broadcastMediaControl = useCallback((type: 'audio' | 'video', enabled: boolean) => {
    if (!peerManagerRef.current || !userProfile) return;

    const controlData: PeerData = {
      type: 'media-control',
      payload: {
        controlType: type,
        enabled,
        userName: userProfile.name,
      },
      timestamp: new Date(),
      senderId: peerManagerRef.current.getPeerId() || '',
    };

    peerManagerRef.current.broadcastData(controlData);
  }, [userProfile]);

  const replaceVideoTrack = useCallback((peerId: string, newStream: MediaStream) => {

    console.log(` Replacing video track for ${peerId}`);
  }, []);

  const playRingtone = useCallback(() => {
    try {
      const audio = new Audio('/meeting-sounds/notification.mp3');
      audio.loop = true;
      audio.play().catch(console.warn);
      
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, 30000);
    } catch (error) {
      console.warn(' Could not play ringtone:', error);
    }
  }, []);

  const getConnectionInfo = useCallback(() => {
    if (!peerManagerRef.current) {
      return {
        peerId: null,
        isConnected: false,
        status: 'disconnected' as const,
        activeCalls: [],
        connectedPeers: [],
      };
    }

    return {
      peerId: peerManagerRef.current.getPeerId(),
      isConnected: peerManagerRef.current.isConnected(),
      status: peerManagerRef.current.getConnectionStatus(),
      activeCalls: peerManagerRef.current.getActiveCalls(),
      connectedPeers: peerManagerRef.current.getConnectedPeers(),
    };
  }, []);


  const cleanup = useCallback(() => {
    if (peerManagerRef.current) {
      peerManagerRef.current.destroy();
      peerManagerRef.current = null;
    }
    setIsInitialized(false);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (callState.isInCall && callState.callStartTime) {
      interval = setInterval(() => {
        updateCallDuration();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.isInCall, callState.callStartTime, updateCallDuration]);


  return {
    isInitialized,
    error,
    connectionInfo: getConnectionInfo(),
    
    initializeMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    
    makeCall,
    answerCall,
    hangupCall,
    
    sendChatMessage,
    
    cleanup,
    reconnect: useCallback(() => {
      if (peerManagerRef.current) {
        peerManagerRef.current.reconnect();
      } else {
        initializePeerManager();
      }
    }, [initializePeerManager]),
    
    getMediaDevices: useCallback(() => {
      return peerManagerRef.current?.getMediaDevices() || Promise.resolve([]);
    }, []),
    
    switchCamera: useCallback((deviceId?: string) => {
      return peerManagerRef.current?.switchCamera(deviceId) || Promise.reject('Peer not initialized');
    }, []),
    
    switchMicrophone: useCallback((deviceId?: string) => {
      return peerManagerRef.current?.switchMicrophone(deviceId) || Promise.reject('Peer not initialized');
    }, []),
    getPeerManager: useCallback(() => peerManagerRef.current, []),
  };
}