
// Debug environment variables

// Primary PeerJS configuration
export const PEER_CONFIG = {
  // Force the correct values since env vars might not be loading
  host:  'rootedwriteups.me', 
  port:  443, 
  path: '/nocap-meet/peerjs',
  
  secure: true, 
  debug: process.env.NODE_ENV === 'development' ? 2 : 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ]
  }
};

// Log the actual configuration being used
console.log('🔧 [CONFIG_DEBUG] PeerJS Configuration:', {
  host: PEER_CONFIG.host,
  port: PEER_CONFIG.port,
  secure: PEER_CONFIG.secure,
  path: PEER_CONFIG.path,
  fullUrl: `${PEER_CONFIG.secure ? 'wss' : 'ws'}://${PEER_CONFIG.host}:${PEER_CONFIG.port}${PEER_CONFIG.path}`,
  fallbackUsed: {
    hostFallback: !process.env.NEXT_PUBLIC_PEERJS_HOST,
    portFallback: !process.env.NEXT_PUBLIC_PEERJS_PORT
  }
});



export const STORAGE_KEYS = {
  USER_PROFILE: 'nocap_user_profile',
  CONTACTS: 'nocap_contacts',
  CALL_HISTORY: 'nocap_call_history', 
  USER_PREFERENCES: 'nocap_user_preferences',
  DEVICE_SETTINGS: 'nocap_device_settings',
} as const;
