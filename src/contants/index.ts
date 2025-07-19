
export const PEER_CONFIG = {
  host: process.env.NEXT_PUBLIC_PEERJS_HOST!, 
  port: parseInt(process.env.NEXT_PUBLIC_PEERJS_PORT!), 
  path: '/nocap-meet/peerjs',
  secure: false, 
  debug: process.env.NODE_ENV === 'development' ? 2 : 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
    ]
  }
};


export const STORAGE_KEYS = {
  USER_PROFILE: 'nocap_user_profile',
  CONTACTS: 'nocap_contacts',
  CALL_HISTORY: 'nocap_call_history', 
  USER_PREFERENCES: 'nocap_user_preferences',
  DEVICE_SETTINGS: 'nocap_device_settings',
} as const;
