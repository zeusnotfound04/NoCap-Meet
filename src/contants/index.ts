export const PEER_CONFIG = {
  host: 'peerjs-server.herokuapp.com',
  port: 443,
  path: '/',
  secure: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }
};

export const STORAGE_KEYS = {
  USER_SETTINGS: 'user_settings',
  MEETING_HISTORY: 'meeting_history',
  AUDIO_SETTINGS: 'audio_settings',
  VIDEO_SETTINGS: 'video_settings',
} as const;

export const MEETING_EVENTS = {
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  CHAT_MESSAGE: 'chat-message',
  SCREEN_SHARE: 'screen-share',
  AUDIO_TOGGLE: 'audio-toggle',
  VIDEO_TOGGLE: 'video-toggle',
} as const;

export const MAX_PARTICIPANTS = 8;
export const CHAT_MESSAGE_LIMIT = 100;
