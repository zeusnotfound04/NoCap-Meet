export interface SignalingMessage {
  type: string;
  from: string;
  to?: string;
  roomId?: string;
  payload?: any;
}

export interface RoomState {
  id: string;
  participants: string[];
}

export interface CallState {
  isInCall: boolean;
  roomId: string | null;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
}
