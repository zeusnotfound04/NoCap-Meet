'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { WS_CONFIG, ICE_SERVERS } from '@/contants';
import type { SignalingMessage, CallState } from '@/types/webrtc';

interface WebRTCContextValue {
  clientId: string | null;
  isConnected: boolean;
  connectionStatus: string;
  callState: CallState;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  toggleVideo: () => void;
  toggleAudio: () => void;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

const WebRTCContext = createContext<WebRTCContextValue | null>(null);

export const WebRTCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [callState, setCallState] = useState<CallState>({
    isInCall: false,
    roomId: null,
    localStream: null,
    remoteStreams: new Map(),
  });
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const localStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream): RTCPeerConnection => {
    console.log('[WebRTC] Creating peer connection for:', peerId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        console.log('[WebRTC] Sending ICE candidate to:', peerId);
        const message: SignalingMessage = {
          type: 'ice-candidate',
          from: clientId!,
          to: peerId,
          payload: event.candidate,
        };
        wsRef.current.send(JSON.stringify(message));
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received track from:', peerId, event.streams[0]);
      setCallState((prev) => {
        const newStreams = new Map(prev.remoteStreams);
        newStreams.set(peerId, event.streams[0]);
        return { ...prev, remoteStreams: newStreams };
      });
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state for', peerId, ':', pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state for', peerId, ':', pc.iceConnectionState);
    };

    stream.getTracks().forEach((track) => {
      console.log('[WebRTC] Adding track to peer connection:', track.kind);
      pc.addTrack(track, stream);
    });

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [clientId]);

  const handleSignalingMessage = useCallback(async (message: SignalingMessage) => {
    console.log('[WebRTC] Received message:', message.type, message);
    
    switch (message.type) {
      case 'connected':
        console.log('[WebRTC] Connected to server, client ID:', message.payload.clientId);
        setClientId(message.payload.clientId);
        setIsConnected(true);
        setConnectionStatus('Connected');
        reconnectAttemptsRef.current = 0;
        break;

      case 'user-joined':
        console.log('[WebRTC] User joined:', message.from);
        if (message.from !== clientId && localStreamRef.current) {
          const pc = createPeerConnection(message.from, localStreamRef.current);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          if (wsRef.current) {
            console.log('[WebRTC] Sending offer to:', message.from);
            const msg: SignalingMessage = {
              type: 'offer',
              from: clientId!,
              to: message.from,
              payload: offer,
            };
            wsRef.current.send(JSON.stringify(msg));
          }
        }
        break;

      case 'offer':
        console.log('[WebRTC] Received offer from:', message.from);
        if (localStreamRef.current) {
          const pc = createPeerConnection(message.from, localStreamRef.current);
          await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (wsRef.current) {
            console.log('[WebRTC] Sending answer to:', message.from);
            const msg: SignalingMessage = {
              type: 'answer',
              from: clientId!,
              to: message.from,
              payload: answer,
            };
            wsRef.current.send(JSON.stringify(msg));
          }
        }
        break;

      case 'answer':
        console.log('[WebRTC] Received answer from:', message.from);
        const existingPc = peerConnections.current.get(message.from);
        if (existingPc) {
          await existingPc.setRemoteDescription(new RTCSessionDescription(message.payload));
        }
        break;

      case 'ice-candidate':
        console.log('[WebRTC] Received ICE candidate from:', message.from);
        const targetPc = peerConnections.current.get(message.from);
        if (targetPc) {
          await targetPc.addIceCandidate(new RTCIceCandidate(message.payload));
        }
        break;

      case 'user-left':
        console.log('[WebRTC] User left:', message.from);
        const leavingPc = peerConnections.current.get(message.from);
        if (leavingPc) {
          leavingPc.close();
          peerConnections.current.delete(message.from);
        }
        setCallState((prev) => {
          const newStreams = new Map(prev.remoteStreams);
          newStreams.delete(message.from);
          return { ...prev, remoteStreams: newStreams };
        });
        break;
    }
  }, [clientId, createPeerConnection]);

  const joinRoom = useCallback(async (roomId: string) => {
    try {
      console.log('[WebRTC] Requesting media permissions...');
      setConnectionStatus('Requesting camera/microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      console.log('[WebRTC] Media stream acquired');
      localStreamRef.current = stream;
      setConnectionStatus('Connecting to signaling server...');

      const wsUrl = `${WS_CONFIG.url}/ws?roomId=${roomId}`;
      console.log('[WebRTC] Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebRTC] WebSocket connection opened');
        setIsConnected(true);
        setConnectionStatus('Connected to server');
        
        setCallState((prev) => ({
          ...prev,
          isInCall: true,
          roomId,
          localStream: stream,
        }));
        
        if (!window.location.pathname.startsWith('/room/')) {
          window.history.pushState({}, '', `/room/${roomId}`);
        }
      };

      ws.onmessage = (event) => {
        const message: SignalingMessage = JSON.parse(event.data);
        handleSignalingMessage(message);
      };

      ws.onerror = (error) => {
        console.error('[WebRTC] WebSocket error:', error);
        setConnectionStatus('Connection error');
      };

      ws.onclose = (event) => {
        console.log('[WebRTC] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        
        if (callState.isInCall && reconnectAttemptsRef.current < 5) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`[WebRTC] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})...`);
          setConnectionStatus(`Reconnecting in ${delay / 1000}s...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[WebRTC] Attempting to reconnect...');
            joinRoom(roomId);
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebRTC] Failed to join room:', error);
      setConnectionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [handleSignalingMessage, callState.isInCall]);

  const leaveRoom = useCallback(() => {
    console.log('[WebRTC] Leaving room...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (callState.localStream) {
      callState.localStream.getTracks().forEach((track) => track.stop());
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setCallState({
      isInCall: false,
      roomId: null,
      localStream: null,
      remoteStreams: new Map(),
    });
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    reconnectAttemptsRef.current = 0;
    
    window.location.href = '/';
  }, [callState.localStream]);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current || callState.localStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        console.log('[WebRTC] Video toggled:', videoTrack.enabled);
      }
    }
  }, [callState.localStream]);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current || callState.localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        console.log('[WebRTC] Audio toggled:', audioTrack.enabled);
      }
    }
  }, [callState.localStream]);

  useEffect(() => {
    console.log('[WebRTC] Provider mounted, checking server connection...');
    setConnectionStatus('Checking server...');
    
    const checkConnection = () => {
      const wsUrl = `${WS_CONFIG.url}/ws?roomId=health-check`;
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        console.log('[WebRTC] Connection check timeout');
        setConnectionStatus('Server unavailable');
        setIsConnected(false);
      }, 5000);

      ws.onopen = () => {
        console.log('[WebRTC] Server is available');
        clearTimeout(timeout);
        setConnectionStatus('Ready');
        setIsConnected(true);
        ws.close();
      };

      ws.onerror = (error) => {
        console.error('[WebRTC] Server connection failed:', error);
        clearTimeout(timeout);
        setConnectionStatus('Server unavailable');
        setIsConnected(false);
      };
    };

    checkConnection();
    
    return () => {
      console.log('[WebRTC] Provider unmounting');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <WebRTCContext.Provider
      value={{
        clientId,
        isConnected,
        connectionStatus,
        callState,
        joinRoom,
        leaveRoom,
        toggleVideo,
        toggleAudio,
        isVideoEnabled,
        isAudioEnabled,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within WebRTCProvider');
  }
  return context;
};
