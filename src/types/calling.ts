export interface UserProfile {
  peerId: string;
  name: string;
  avatar?: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  isAcceptingCalls: boolean;
  lastSeen: Date;
}

export interface IncomingCall {
  callId: string;
  callerPeerId: string;
  callerName: string;
  callerAvatar?: string;
  timestamp: Date;
  type: 'video' | 'audio';
}

export interface CallState {
  isInCall: boolean;
  isIncomingCall: boolean;
  currentCall: IncomingCall | null;
  callStartTime?: Date;
  callDuration: number;
}

export interface Contact {
  peerId: string;
  name: string;
  avatar?: string;
  addedAt: Date;
  lastCallAt?: Date;
  isFavorite: boolean;
}