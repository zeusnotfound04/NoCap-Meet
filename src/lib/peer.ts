import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { PEER_CONFIG } from "@/contants"
import { PeerData } from '@/types/peer';

export class PeerManager {
  private peer: Peer | null = null;
  private mediaConnections: Map<string, MediaConnection> = new Map();
  private dataConnections: Map<string, DataConnection> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private callbacks: {
    onOpen?: (peerId: string) => void;
    onCall?: (call: MediaConnection) => void;
    onConnection?: (conn: DataConnection) => void;
    onData?: (data: PeerData, peerId: string) => void;
    onStream?: (stream: MediaStream, peerId: string) => void;
    onClose?: (peerId: string) => void;
    onError?: (error: Error) => void;
    onDisconnected?: () => void;
  } = {};

  constructor() {
    this.initializePeer();
  }

  // ===== PEER INITIALIZATION =====

  private initializePeer(): void {
    try {
      // Create peer with configuration
      this.peer = new Peer({
        ...PEER_CONFIG,
        debug: process.env.NODE_ENV === 'development' ? 2 : 0,
      });

      this.setupPeerEventListeners();
    } catch (error) {
      console.error('❌ Failed to initialize peer:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  private setupPeerEventListeners(): void {
    if (!this.peer) return;

    // Peer connection opened
    this.peer.on('open', (peerId: string) => {
      console.log('✅ Peer connection opened with ID:', peerId);
      this.callbacks.onOpen?.(peerId);
    });

    // Incoming data connection
    this.peer.on('connection', (conn: DataConnection) => {
      console.log('📡 Incoming data connection from:', conn.peer);
      this.setupDataConnection(conn);
      this.callbacks.onConnection?.(conn);
    });

    // Incoming media call
    this.peer.on('call', (call: MediaConnection) => {
      console.log('📞 Incoming call from:', call.peer);
      this.callbacks.onCall?.(call);
    });

    // Peer disconnected
    this.peer.on('disconnected', () => {
      console.log('🔌 Peer disconnected');
      this.callbacks.onDisconnected?.();
    });

    // Peer error
    this.peer.on('error', (error: Error) => {
      console.error('❌ Peer error:', error);
      this.callbacks.onError?.(error);
    });

    // Peer closed
    this.peer.on('close', () => {
      console.log('🔒 Peer connection closed');
      this.cleanup();
    });
  }

  // ===== EVENT HANDLERS =====

  public setEventHandlers(callbacks: typeof this.callbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // ===== MEDIA STREAM MANAGEMENT =====

  public async getLocalStream(
    constraints: MediaStreamConstraints = { video: true, audio: true }
  ): Promise<MediaStream> {
    try {
      if (this.localStream) {
        // Stop existing tracks
        this.localStream.getTracks().forEach(track => track.stop());
      }

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('📹 Local stream acquired');
      return this.localStream;
    } catch (error) {
      console.error('❌ Failed to get local stream:', error);
      throw error;
    }
  }

  public async getScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Listen for screen share end
      this.screenStream.getVideoTracks()[0].onended = () => {
        console.log('🖥️ Screen sharing ended');
        this.screenStream = null;
      };

      console.log('🖥️ Screen share acquired');
      return this.screenStream;
    } catch (error) {
      console.error('❌ Failed to get screen share:', error);
      throw error;
    }
  }

  public getLocalStream_Current(): MediaStream | null {
    return this.localStream;
  }

  public getScreenStream_Current(): MediaStream | null {
    return this.screenStream;
  }

  public stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
      console.log('📹 Local stream stopped');
    }
  }

  public stopScreenShare(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
      console.log('🖥️ Screen share stopped');
    }
  }

  // ===== CALLING FUNCTIONALITY =====

  public async makeCall(
    targetPeerId: string, 
    stream?: MediaStream,
    metadata?: any
  ): Promise<MediaConnection> {
    console.log(`📞 [PeerManager.makeCall] Starting call to ${targetPeerId}`);
    console.log(`🔧 [PeerManager.makeCall] Metadata:`, metadata);
    
    if (!this.peer) {
      console.error(`❌ [PeerManager.makeCall] Peer not initialized`);
      throw new Error('Peer not initialized');
    }

    try {
      const callStream = stream || this.localStream;
      if (!callStream) {
        console.error(`❌ [PeerManager.makeCall] No stream available for call`);
        throw new Error('No stream available for call');
      }
      
      console.log(`📡 [PeerManager.makeCall] Using stream:`, {
        streamId: callStream.id,
        videoTracks: callStream.getVideoTracks().length,
        audioTracks: callStream.getAudioTracks().length,
        active: callStream.active
      });

      console.log(`📞 [PeerManager.makeCall] Creating call to ${targetPeerId}...`);
      const call = this.peer.call(targetPeerId, callStream, { metadata });
      
      console.log(`🔧 [PeerManager.makeCall] Setting up media connection...`);
      this.setupMediaConnection(call);
      
      console.log(`✅ [PeerManager.makeCall] Call initiated successfully to ${targetPeerId}`);
      return call;
    } catch (error) {
      console.error('❌ [PeerManager.makeCall] Failed to make call:', error);
      throw error;
    }
  }

  public async answerCall(
    call: MediaConnection, 
    stream?: MediaStream
  ): Promise<void> {
    try {
      const answerStream = stream || this.localStream;
      if (!answerStream) {
        throw new Error('No stream available to answer call');
      }

      call.answer(answerStream);
      this.setupMediaConnection(call);
      
      console.log(`✅ Answered call from ${call.peer}`);
    } catch (error) {
      console.error('❌ Failed to answer call:', error);
      throw error;
    }
  }

  private setupMediaConnection(call: MediaConnection): void {
    console.log(`🔧 [PeerManager.setupMediaConnection] Setting up media connection with ${call.peer}`);
    this.mediaConnections.set(call.peer, call);

    call.on('stream', (remoteStream: MediaStream) => {
      console.log('📺 [PeerManager.setupMediaConnection] Received remote stream from:', call.peer);
      console.log('🔧 [PeerManager.setupMediaConnection] Remote stream details:', {
        streamId: remoteStream.id,
        videoTracks: remoteStream.getVideoTracks().length,
        audioTracks: remoteStream.getAudioTracks().length,
        active: remoteStream.active
      });
      this.callbacks.onStream?.(remoteStream, call.peer);
    });

    call.on('close', () => {
      console.log('📞 [PeerManager.setupMediaConnection] Call closed with:', call.peer);
      this.mediaConnections.delete(call.peer);
      this.callbacks.onClose?.(call.peer);
    });

    call.on('error', (error: Error) => {
      console.error('❌ [PeerManager.setupMediaConnection] Call error with:', call.peer, error);
      this.mediaConnections.delete(call.peer);
      this.callbacks.onError?.(error);
    });
    
    console.log(`✅ [PeerManager.setupMediaConnection] Media connection setup complete for ${call.peer}`);
  }

  // ===== DATA CONNECTION FUNCTIONALITY =====

  public connectToPeer(targetPeerId: string, metadata?: any): DataConnection {
    console.log(` [PeerManager.connectToPeer] Connecting to ${targetPeerId}`);
    console.log(` [PeerManager.connectToPeer] Metadata:`, metadata);
    
    if (!this.peer) {
      console.error(`❌ [PeerManager.connectToPeer] Peer not initialized`);
      throw new Error('Peer not initialized');
    }

    console.log(` [PeerManager.connectToPeer] Creating data connection...`);
    const conn = this.peer.connect(targetPeerId, { metadata });
    
    console.log(` [PeerManager.connectToPeer] Setting up data connection handlers...`);
    this.setupDataConnection(conn);
    
    console.log(` [PeerManager.connectToPeer] Connection initiated to ${targetPeerId}`);
    return conn;
  }

  private setupDataConnection(conn: DataConnection): void {
    this.dataConnections.set(conn.peer, conn);

    conn.on('open', () => {
      console.log(' Data connection opened with:', conn.peer);
    });

    conn.on('data', (data: any) => {
      console.log(' Received data from:', conn.peer, data);
      this.callbacks.onData?.(data, conn.peer);
    });

    conn.on('close', () => {
      console.log(' Data connection closed with:', conn.peer);
      this.dataConnections.delete(conn.peer);
    });

    conn.on('error', (error: Error) => {
      console.error(' Data connection error with:', conn.peer, error);
      this.dataConnections.delete(conn.peer);
    });
  }

  public sendData(peerId: string, data: PeerData ): boolean {
    const conn = this.dataConnections.get(peerId);
    if (conn && conn.open) {
      conn.send(data);
      return true;
    }
    return false;
  }

  public broadcastData(data: PeerData): void {
    this.dataConnections.forEach((conn, peerId) => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }


  public toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;

    const audioTracks = this.localStream.getAudioTracks();
    const newState = enabled !== undefined ? enabled : !audioTracks[0]?.enabled;
    
    audioTracks.forEach(track => {
      track.enabled = newState;
    });

    console.log(` Audio ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  public toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;

    const videoTracks = this.localStream.getVideoTracks();
    const newState = enabled !== undefined ? enabled : !videoTracks[0]?.enabled;
    
    videoTracks.forEach(track => {
      track.enabled = newState;
    });

    console.log(`📹 Video ${newState ? 'enabled' : 'disabled'}`);
    return newState;
  }

  public hangupCall(peerId: string): void {
    const call = this.mediaConnections.get(peerId);
    if (call) {
      call.close();
      this.mediaConnections.delete(peerId);
      console.log(` Hung up call with ${peerId}`);
    }
  }

  public hangupAllCalls(): void {
    this.mediaConnections.forEach((call, peerId) => {
      call.close();
      console.log(` Hung up call with ${peerId}`);
    });
    this.mediaConnections.clear();
  }

  public disconnectFromPeer(peerId: string): void {
    const conn = this.dataConnections.get(peerId);
    if (conn) {
      conn.close();
      this.dataConnections.delete(peerId);
      console.log(` Disconnected from ${peerId}`);
    }
  }

  public disconnectFromAllPeers(): void {
    this.dataConnections.forEach((conn, peerId) => {
      conn.close();
      console.log(` Disconnected from ${peerId}`);
    });
    this.dataConnections.clear();
  }


  public getPeerId(): string | null {
    return this.peer?.id || null;
  }

  public isConnected(): boolean {
    return this.peer?.open === true;
  }

  public getConnectedPeers(): string[] {
    return Array.from(this.dataConnections.keys());
  }

  public getActiveCalls(): string[] {
    return Array.from(this.mediaConnections.keys());
  }

  public getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (!this.peer) return 'disconnected';
    if (this.peer.destroyed) return 'disconnected';
    if (this.peer.disconnected) return 'disconnected';
    if (this.peer.open) return 'connected';
    return 'connecting';
  }


  private cleanup(): void {
    this.stopLocalStream();
    this.stopScreenShare();

    this.hangupAllCalls();
    this.disconnectFromAllPeers();

    this.mediaConnections.clear();
    this.dataConnections.clear();
  }

  public destroy(): void {
    console.log('🗑️ Destroying peer manager');
    
    this.cleanup();
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  public async reconnect(): Promise<void> {
    if (this.peer) {
      this.peer.reconnect();
      console.log('🔄 Attempting to reconnect peer');
    } else {
      this.initializePeer();
    }
  }

  public getMediaDevices(): Promise<MediaDeviceInfo[]> {
    return navigator.mediaDevices.enumerateDevices();
  }

  public async switchCamera(deviceId?: string): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: true
    };
    
    return this.getLocalStream(constraints);
  }

  public async switchMicrophone(deviceId?: string): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: true,
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    };
    
    return this.getLocalStream(constraints);
  }
}