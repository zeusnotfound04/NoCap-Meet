import { create } from 'zustand';
import { StorageManager } from '@/lib/storage';
import { Participant, ChatMessage, Meeting } from '@/types/meeting';
import { UserProfile, IncomingCall, CallState, Contact } from '@/types/calling';


interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoAcceptCalls: boolean;
  defaultCallType: 'video' | 'audio';
  soundEnabled: boolean;
}

interface DeviceSettings {
  preferredCamera?: string;
  preferredMicrophone?: string;
  preferredSpeaker?: string;
  videoQuality: 'low' | 'medium' | 'high';
  audioQuality: 'low' | 'medium' | 'high';
}

interface RecentRoom {
  roomId: string;
  roomName: string;
  lastJoined: string;
  participants: number;
}

interface CallHistory {
  id: string;
  peerId: string;
  name: string;
  type: 'incoming' | 'outgoing' | 'missed';
  callType: 'video' | 'audio';
  duration?: number;
  timestamp: Date;
}

interface MeetingStore {
  userProfile: UserProfile | null;
  contacts: Contact[];
  callHistory: CallHistory[];
  userPreferences: UserPreferences;
  deviceSettings: DeviceSettings;
  recentRooms: RecentRoom[];
  
  currentMeeting: Meeting | null;
  participants: Participant[];
  messages: ChatMessage[];
  isConnected: boolean;
  
  currentUser: Participant | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  
  callState: CallState;
  activeMediaCall: any; 
  
  isChatOpen: boolean;
  isParticipantsListOpen: boolean;
  isSettingsOpen: boolean;
  isLoading: boolean;
  error: string | null;
  
  myPeerId: string | null;
  isOnline: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  initializeStore: () => Promise<void>;
  loadUserData: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  initializeUser: (name: string) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateUserStatus: (status: UserProfile['status']) => Promise<void>;
  setMyPeerId: (peerId: string) => void;
  setOnlineStatus: (online: boolean) => void;
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  
  addContact: (peerId: string, name: string) => Promise<void>;
  removeContact: (peerId: string) => Promise<void>;
  updateContact: (peerId: string, updates: Partial<Contact>) => Promise<void>;
  toggleContactFavorite: (peerId: string) => Promise<void>;
  loadContacts: () => Promise<void>;
  
  setIncomingCall: (call: IncomingCall) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  startOutgoingCall: (targetPeerId: string, callType?: 'video' | 'audio') => void;
  setActiveMediaCall: (call: any) => void;
  updateCallDuration: () => void;
  
  addCallToHistory: (call: Omit<CallHistory, 'id'>) => Promise<void>;
  loadCallHistory: () => Promise<void>;
  clearCallHistory: () => Promise<void>;
  
  setCurrentMeeting: (meeting: Meeting | null) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (participantId: string, updates: Partial<Participant>) => void;
  setCurrentUser: (user: Participant) => void;
  
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  toggleChat: () => void;
  
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setScreenStream: (stream: MediaStream | null) => void;
  
  toggleParticipantsList: () => void;
  toggleSettings: () => void;
  
  updateUserPreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  updateDeviceSettings: (settings: Partial<DeviceSettings>) => Promise<void>;
  loadPreferences: () => Promise<void>;
  
  addRecentRoom: (roomId: string, roomName?: string) => Promise<void>;
  loadRecentRooms: () => Promise<void>;
  clearRecentRooms: () => Promise<void>;
  
  resetMeetingState: () => void;
  resetCallState: () => void;
  clearAllData: () => Promise<void>;
  exportData: () => Promise<any>;
  importData: (data: any) => Promise<void>;
}


export const useMeetingStore = create<MeetingStore>((set: any, get : any) => ({

  userProfile: null,
  contacts: [],
  callHistory: [],
  userPreferences: {
    theme: 'light',
    notifications: true,
    autoAcceptCalls: false,
    defaultCallType: 'video',
    soundEnabled: true,
  },
  deviceSettings: {
    videoQuality: 'medium',
    audioQuality: 'high',
  },
  recentRooms: [],
  
  currentMeeting: null,
  participants: [],
  messages: [],
  isConnected: false,
  currentUser: null,
  isAudioMuted: false,
  isVideoMuted: false,
  isScreenSharing: false,
  localStream: null,
  screenStream: null,
  
  callState: {
    isInCall: false,
    isIncomingCall: false,
    currentCall: null,
    callDuration: 0,
  },
  activeMediaCall: null,
  
  isChatOpen: false,
  isParticipantsListOpen: false,
  isSettingsOpen: false,
  isLoading: true,
  error: null,
  
  myPeerId: null,
  isOnline: false,
  connectionStatus: 'connecting',
  
  initializeStore: async () => {
    try {
      set({ isLoading: true, error: null });
      await get().loadUserData();
      await get().loadContacts();
      await get().loadCallHistory();
      await get().loadPreferences();
      await get().loadRecentRooms();
      set({ isLoading: false });
      console.log(' Store initialized successfully');
    } catch (error) {
      console.error(' Failed to initialize store:', error);
      set({ isLoading: false, error: 'Failed to initialize app' });
    }
  },
  
  loadUserData: async () => {
    try {
      const profile = await StorageManager.getUserProfile();
      if (profile) {
        set({ userProfile: profile });
      }
    } catch (error) {
      console.error(' Failed to load user data:', error);
    }
  },
  
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
  
  // ===== USER PROFILE ACTIONS =====
  
  initializeUser: async (name: string) => {
    try {
      const existingProfile = await StorageManager.getUserProfile();
      
      let profile: UserProfile;
      if (existingProfile) {
        profile = {
          ...existingProfile,
          name: name.trim(),
          status: 'online',
          lastSeen: new Date(),
        };
      } else {
        profile = {
          peerId: '', // Will be set when peer connects
          name: name.trim(),
          status: 'online',
          isAcceptingCalls: true,
          lastSeen: new Date(),
        };
      }
      
      await StorageManager.setUserProfile(profile);
      set({ userProfile: profile });
      console.log(` User initialized: ${name}`);
    } catch (error) {
      console.error(' Failed to initialize user:', error);
      set({ error: 'Failed to save user profile' });
    }
  },
  
  updateUserProfile: async (updates: Partial<UserProfile>) => {
    try {
      const current = get().userProfile;
      if (current) {
        const updated = { ...current, ...updates };
        await StorageManager.setUserProfile(updated);
        set({ userProfile: updated });
        console.log(' User profile updated');
      }
    } catch (error) {
      console.error(' Failed to update user profile:', error);
    }
  },
  
  updateUserStatus: async (status: UserProfile['status']) => {
    try {
      await StorageManager.updateUserStatus(status);
      const profile = get().userProfile;
      if (profile) {
        set({ userProfile: { ...profile, status, lastSeen: new Date() } });
      }
    } catch (error) {
      console.error(' Failed to update user status:', error);
    }
  },
  
  setMyPeerId: (peerId: string) => {
    set({ myPeerId: peerId });
    
    const profile = get().userProfile;
    if (profile && profile.peerId !== peerId) {
      const updated = { ...profile, peerId };
      StorageManager.setUserProfile(updated);
      set({ userProfile: updated });
    }
  },
  
  setOnlineStatus: (online: boolean) => {
    set({ isOnline: online });
    get().updateUserStatus(online ? 'online' : 'offline');
  },
  
  setConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    set({ connectionStatus: status });
    if (status === 'connected') {
      set({ isOnline: true });
      get().updateUserStatus('online');
    } else if (status === 'disconnected' || status === 'error') {
      set({ isOnline: false });
      get().updateUserStatus('offline');
    }
  },
  
  
  addContact: async (peerId: string, name: string) => {
    try {
      const newContact: Contact = {
        peerId,
        name: name.trim(),
        addedAt: new Date(),
        isFavorite: false,
      };
      
      await StorageManager.addContact(newContact);
      await get().loadContacts();
      console.log(` Contact added: ${name}`);
    } catch (error) {
      console.error(' Failed to add contact:', error);
      set({ error: 'Failed to add contact' });
    }
  },
  
  removeContact: async (peerId: string) => {
    try {
      await StorageManager.removeContact(peerId);
      await get().loadContacts();
      console.log(` Contact removed: ${peerId}`);
    } catch (error) {
      console.error(' Failed to remove contact:', error);
    }
  },
  
  updateContact: async (peerId: string, updates: Partial<Contact>) => {
    try {
      const contacts = get().contacts;
      const updated = contacts.map((c: any) => 
        c.peerId === peerId ? { ...c, ...updates } : c
      );
      
      const updatedContact = updated.find((c: any) => c.peerId === peerId);
      if (updatedContact) {
        await StorageManager.addContact(updatedContact);
        set({ contacts: updated });
        console.log(` Contact updated: ${peerId}`);
      } else {
        console.warn(` Contact not found: ${peerId}`);
      }
    } catch (error) {
      console.error(' Failed to update contact:', error);
    }
  },
  
  toggleContactFavorite: async (peerId: string) => {
    try {
      await StorageManager.toggleContactFavorite(peerId);
      await get().loadContacts();
    } catch (error) {
      console.error(' Failed to toggle favorite:', error);
    }
  },
  
  loadContacts: async () => {
    try {
      const contacts = await StorageManager.getContacts();
      set({ contacts });
    } catch (error) {
      console.error(' Failed to load contacts:', error);
    }
  },
  
  // ===== CALL MANAGEMENT =====
  
  setIncomingCall: (call: IncomingCall) => {
    set({
      callState: {
        ...get().callState,
        isIncomingCall: true,
        currentCall: call,
      }
    });
    
    const { userPreferences } = get();
    if (userPreferences.soundEnabled) {
      console.log(' Incoming call ringtone');
    }
  },
  
  acceptCall: () => {
    const call = get().callState.currentCall;
    if (call) {
      set({
        callState: {
          isInCall: true,
          isIncomingCall: false,
          currentCall: call,
          callStartTime: new Date(),
          callDuration: 0,
        }
      });
      console.log(' Call accepted');
    }
  },
  
  rejectCall: async () => {
    const call = get().callState.currentCall;
    if (call) {
      await get().addCallToHistory({
        peerId: call.callerPeerId,
        name: call.callerName,
        type: 'missed',
        callType: call.type,
        timestamp: call.timestamp,
      });
    }
    
    get().resetCallState();
    console.log(' Call rejected');
  },
  
  endCall: async () => {
    const callState = get().callState;
    
    if (callState.currentCall && callState.callStartTime) {
      const duration = Math.floor((Date.now() - callState.callStartTime.getTime()) / 1000);
      
      await get().addCallToHistory({
        peerId: callState.currentCall.callerPeerId,
        name: callState.currentCall.callerName,
        type: 'incoming',
        callType: callState.currentCall.type,
        duration,
        timestamp: callState.callStartTime,
      });
      
      await StorageManager.updateLastCall(callState.currentCall.callerPeerId);
    }
    
    const { localStream, screenStream, activeMediaCall } = get();
    if (localStream) {
      localStream.getTracks().forEach((track: any) => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track: any) => track.stop());
    }
    if (activeMediaCall) {
      activeMediaCall.close();
    }
    
    get().resetCallState();
    set({ 
      localStream: null, 
      screenStream: null, 
      activeMediaCall: null,
      isAudioMuted: false,
      isVideoMuted: false,
      isScreenSharing: false,
    });
    
    console.log(' Call ended');
  },
  
  startOutgoingCall: (targetPeerId: string, callType: 'video' | 'audio' = 'video') => {

    console.log(` Starting ${callType} call to:`, targetPeerId);
    
    const contact = get().contacts.find((c: any) => c.peerId === targetPeerId);
    get().addCallToHistory({
      peerId: targetPeerId,
      name: contact?.name || 'Unknown',
      type: 'outgoing',
      callType,
      timestamp: new Date(),
    });
  },
  
  setActiveMediaCall: (call: any) => set({ activeMediaCall: call }),
  
  updateCallDuration: () => {
    const callState = get().callState;
    if (callState.isInCall && callState.callStartTime) {
      const duration = Math.floor((Date.now() - callState.callStartTime.getTime()) / 1000);
      set({
        callState: { ...callState, callDuration: duration }
      });
    }
  },
  
  
  addCallToHistory: async (call: Omit<CallHistory, 'id'>) => {
    try {
      await StorageManager.addCallToHistory(call);
      await get().loadCallHistory();
    } catch (error) {
      console.error(' Failed to add call to history:', error);
    }
  },
  
  loadCallHistory: async () => {
    try {
      const history = await StorageManager.getCallHistory();
      set({ callHistory: history });
    } catch (error) {
      console.error(' Failed to load call history:', error);
    }
  },
  
  clearCallHistory: async () => {
    try {
      await StorageManager.clearCallHistory();
      set({ callHistory: [] });
    } catch (error) {
      console.error(' Failed to clear call history:', error);
    }
  },
  
  
  setCurrentMeeting: (meeting: Meeting | null) => set({ currentMeeting: meeting }),
  
  addParticipant: (participant: Participant) => set((state : any) => ({
    participants: [...state.participants, participant]
  })),
  
  removeParticipant: (participantId: string) => set((state: any) => ({
    participants: state.participants.filter((p: any) => p.id !== participantId)
  })),
  
  updateParticipant: (participantId: string, updates: Partial<Participant>) => set((state: any) => ({
    participants: state.participants.map((p : any)=> 
      p.id === participantId ? { ...p, ...updates } : p
    )
  })),
  
  setCurrentUser: (user: Participant) => set({ currentUser: user }),
  
  
  addMessage: (message: ChatMessage) => set((state : any) => ({
    messages: [...state.messages, message]
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  toggleChat: () => set((state: any) => ({ 
    isChatOpen: !state.isChatOpen 
  })),
  
  toggleAudio: () => {
    const isAudioMuted = !get().isAudioMuted;
    set({ isAudioMuted });
    
    const { localStream } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track : any) => {
        track.enabled = !isAudioMuted;
      });
    }
    
    console.log(` Audio ${isAudioMuted ? 'muted' : 'unmuted'}`);
  },
  
  toggleVideo: () => {
    const isVideoMuted = !get().isVideoMuted;
    set({ isVideoMuted });
    
    const { localStream } = get();
    if (localStream) {
      localStream.getVideoTracks().forEach((track : any)=> {
        track.enabled = !isVideoMuted;
      });
    }
    
    console.log(`📹 Video ${isVideoMuted ? 'disabled' : 'enabled'}`);
  },
  
  toggleScreenShare: () => {
    const isScreenSharing = !get().isScreenSharing;
    set({ isScreenSharing });
    console.log(` Screen sharing ${isScreenSharing ? 'started' : 'stopped'}`);
  },
  
  setLocalStream: (stream: MediaStream | null) => set({ localStream: stream }),
  setScreenStream: (stream: MediaStream | null) => set({ screenStream: stream }),
  
  
  toggleParticipantsList: () => set((state : any) => ({ 
    isParticipantsListOpen: !state.isParticipantsListOpen 
  })),
  
  toggleSettings: () => set((state : any) => ({ 
    isSettingsOpen: !state.isSettingsOpen 
  })),
  
  updateUserPreferences: async (prefs: Partial<UserPreferences>) => {
    try {
      const current = get().userPreferences;
      const updated = { ...current, ...prefs };
      
      await StorageManager.setUserPreferences(updated);
      set({ userPreferences: updated });
      console.log(' Preferences updated');
    } catch (error) {
      console.error(' Failed to update preferences:', error);
    }
  },
  
  updateDeviceSettings: async (settings: Partial<DeviceSettings>) => {
    try {
      const current = get().deviceSettings;
      const updated = { ...current, ...settings };
      
      await StorageManager.setDeviceSettings(updated);
      set({ deviceSettings: updated });
      console.log(' Device settings updated');
    } catch (error) {
      console.error(' Failed to update device settings:', error);
    }
  },
  
  loadPreferences: async () => {
    try {
      const [userPrefs, deviceSettings] = await Promise.all([
        StorageManager.getUserPreferences(),
        StorageManager.getDeviceSettings()
      ]);
      
      set({ userPreferences: userPrefs, deviceSettings });
    } catch (error) {
      console.error(' Failed to load preferences:', error);
    }
  },
  
  addRecentRoom: async (roomId: string, roomName?: string) => {
    try {
      await StorageManager.addToRecentRooms(roomId, roomName);
      await get().loadRecentRooms();
    } catch (error) {
      console.error(' Failed to add recent room:', error);
    }
  },
  
  loadRecentRooms: async () => {
    try {
      const rooms = await StorageManager.getRecentRooms();
      set({ recentRooms: rooms });
    } catch (error) {
      console.error(' Failed to load recent rooms:', error);
    }
  },
  
  clearRecentRooms: async () => {
    try {
      await StorageManager.clearRecentRooms();
      set({ recentRooms: [] });
    } catch (error) {
      console.error(' Failed to clear recent rooms:', error);
    }
  },
  
  resetMeetingState: () => {
    set({
      currentMeeting: null,
      participants: [],
      messages: [],
      isConnected: false,
      currentUser: null,
      isChatOpen: false,
      isParticipantsListOpen: false,
    });
    console.log(' Meeting state reset');
  },
  
  resetCallState: () => {
    set({
      callState: {
        isInCall: false,
        isIncomingCall: false,
        currentCall: null,
        callDuration: 0,
      }
    });
  },
  
  clearAllData: async () => {
    try {
      await StorageManager.clearAllData();
      set({
        userProfile: null,
        contacts: [],
        callHistory: [],
        recentRooms: [],
        userPreferences: {
          theme: 'light',
          notifications: true,
          autoAcceptCalls: false,
          defaultCallType: 'video',
          soundEnabled: true,
        },
        deviceSettings: {
          videoQuality: 'medium',
          audioQuality: 'high',
        },
      });
      console.log(' All data cleared');
    } catch (error) {
      console.error(' Failed to clear all data:', error);
    }
  },
  
  exportData: async () => {
    try {
      return await StorageManager.exportAllData();
    } catch (error) {
      console.error(' Failed to export data:', error);
      return {};
    }
  },
  
  importData: async (data: any) => {
    try {
      await StorageManager.importAllData(data);
      await get().initializeStore();
      console.log(' Data imported successfully');
    } catch (error) {
      console.error(' Failed to import data:', error);
      set({ error: 'Failed to import data' });
    }
  },
}));