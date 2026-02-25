export const WS_CONFIG = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
};

export const ICE_SERVERS = [
  // STUN servers for NAT traversal
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  
  // Free Open Relay TURN servers (when direct connection fails)
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
