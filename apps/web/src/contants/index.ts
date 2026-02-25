export const WS_CONFIG = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
};

export const ICE_SERVERS = [
  // STUN servers for NAT traversal
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  
  // Twilio STUN/TURN servers (free and reliable)
  {
    urls: 'stun:global.stun.twilio.com:3478',
  },
  {
    urls: 'turn:global.turn.twilio.com:3478?transport=udp',
    username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
    credential: 'w1uxM55V9yVoqJNRQaT7V5pU/GPH96NFpg5PwZDT8IQ=',
  },
  {
    urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
    username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
    credential: 'w1uxM55V9yVoqJNRQaT7V5pU/GPH96NFpg5PwZDT8IQ=',
  },
  {
    urls: 'turn:global.turn.twilio.com:443?transport=tcp',
    username: 'f4b4035eaa76f4a55de5f4351567653ee4ff6fa97b50b6b334fcc1be9c27212d',
    credential: 'w1uxM55V9yVoqJNRQaT7V5pU/GPH96NFpg5PwZDT8IQ=',
  },
  
  // Backup: Open Relay TURN servers
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const STORAGE_KEYS = {
  USER_PROFILE: 'nocap_user_profile',
  CONTACTS: 'nocap_contacts',
  CALL_HISTORY: 'nocap_call_history', 
  USER_PREFERENCES: 'nocap_user_preferences',
  DEVICE_SETTINGS: 'nocap_device_settings',
} as const;
