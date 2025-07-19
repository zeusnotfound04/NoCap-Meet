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
  
  currentUserId: string | null; 
  
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
  
  initializeStore: (userId?: string) => Promise<void>;
  setCurrentUserId: (userId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  initializeUser: (name: string, userId?: string) => Promise<void>;
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
  setCallConnected: () => void; 
  updateCallDuration: () => void;
  
  addCallToHistory: (call: Omit<CallHistory, 'id'>) => Promise<void>;
  updateCallHistory: (peerId: string, updates: Partial<Pick<CallHistory, 'name' | 'duration' | 'type'>>) => Promise<void>;
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
  
  addRecentRoom: (roomId: string, roomName?: string) => Promise<void>;
  clearRecentRooms: () => Promise<void>;
  
  resetMeetingState: () => void;
  resetCallState: () => void;
  clearAllData: () => Promise<void>;
}

const generateUserId = (): string => {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getOrCreateUserId = (): string => {
  if (typeof window === 'undefined') return generateUserId();
  
  const stored = localStorage.getItem('nocap-meet-user-id');
  if (stored) return stored;
  
  const newId = generateUserId();
  localStorage.setItem('nocap-meet-user-id', newId);
  return newId;
};


export const useMeetingStore = create<MeetingStore>((set, get) => ({

  currentUserId: null,
  
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
  
  
  setCurrentUserId: (userId: string) => {
    set({ currentUserId: userId });
    if (typeof window !== 'undefined') {
      localStorage.setItem('nocap-meet-user-id', userId);
    }
  },
  
  initializeStore: async (userId?: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const actualUserId = userId || getOrCreateUserId();
      set({ currentUserId: actualUserId });
      
      
      try {
        await StorageManager.initializeStorage();
        console.log(' Store: Redis storage ready');
      } catch (storageError) {
        console.warn(' Store: Redis initialization failed, using in-memory defaults:', storageError);
   
        set({ 
          isLoading: false, 
          error: null,
          userProfile: null,
          contacts: [],
          userPreferences: {
            theme: 'light',
            notifications: true,
            autoAcceptCalls: false,
            defaultCallType: 'video',
            soundEnabled: true,
          }
        });
        return;
      }
      
      const createTimeoutPromise = (ms: number) => new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
      );
      
      console.log(' Store: Loading user profile...');
      const profile = await Promise.race([
        StorageManager.getUserProfile(actualUserId),
        createTimeoutPromise(3000)
      ]).catch(error => {
        console.warn(' Store: Failed to load profile:', error);
        return null;
      });
      
      console.log(' Store: Loading contacts...');
      const contacts = await Promise.race([
        StorageManager.getContacts(actualUserId),
        createTimeoutPromise(3000)
      ]).catch(error => {
        console.warn(' Store: Failed to load contacts:', error);
        return [] as Contact[];
      });
      
      const preferences = await Promise.race([
        StorageManager.getUserPreferences(actualUserId),
        createTimeoutPromise(3000)
      ]).catch(error => {
        console.warn(' Store: Failed to load preferences:', error);
        return {
          theme: 'light' as const,
          notifications: true,
          autoAcceptCalls: false,
          defaultCallType: 'video' as const,
          soundEnabled: true,
        };
      });
      
      console.log(' Store: Data loaded - profile:', !!profile, 'contacts:', (contacts as Contact[]).length || 0, 'preferences:', !!preferences);
      
      const updates: Partial<MeetingStore> = {
        userProfile: profile as UserProfile | null,
        contacts: (contacts as Contact[]) || [],
        userPreferences: preferences || get().userPreferences,
        isLoading: false,
      };
      
      set(updates);
      
      console.log(' Store: Initialization complete');
      
      setTimeout(() => {
        get().loadCallHistory().catch(console.warn);
      }, 100);
      
    } catch (error) {
      console.error(' Store: Initialization failed:', error);
      
      set({ 
        isLoading: false, 
        error: null, 
        userProfile: null,
        contacts: [],
        userPreferences: {
          theme: 'light',
          notifications: true,
          autoAcceptCalls: false,
          defaultCallType: 'video',
          soundEnabled: true,
        }
      });
      
      console.log(' Store: Using default values due to storage error');
    }
  },
  
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
  
  
  initializeUser: async (name: string, userId?: string) => {
    try {
      console.log(' Store: Initializing user:', name);
      
      const actualUserId = userId || get().currentUserId || getOrCreateUserId();
      if (!get().currentUserId) {
        set({ currentUserId: actualUserId });
      }
      
      const existingProfile = get().userProfile;
      
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
          peerId: '', // Will be set by peer context
          name: name.trim(),
          status: 'online',
          isAcceptingCalls: true,
          lastSeen: new Date(),
        };
      }
      
      await StorageManager.setUserProfile(profile, actualUserId);
      set({ userProfile: profile });
      
    } catch (error) {
      console.error(' Store: Failed to initialize user:', error);
      set({ error: 'Failed to save user profile' });
    }
  },
  
  updateUserProfile: async (updates: Partial<UserProfile>) => {
    try {
      const current = get().userProfile;
      const userId = get().currentUserId;
      if (current && userId) {
        const updated = { ...current, ...updates };
        await StorageManager.setUserProfile(updated, userId);
        set({ userProfile: updated });
      }
    } catch (error) {
      console.error(' Store: Failed to update user profile:', error);
    }
  },
  
  updateUserStatus: async (status: UserProfile['status']) => {
    try {
      const userId = get().currentUserId;
      if (userId) {
        await StorageManager.updateUserStatus(status, userId);
        const profile = get().userProfile;
        if (profile) {
          set({ userProfile: { ...profile, status, lastSeen: new Date() } });
        }
      }
    } catch (error) {
      console.error(' Store: Failed to update user status:', error);
    }
  },
  
  setMyPeerId: (peerId: string) => {
    set({ myPeerId: peerId });
    
    const profile = get().userProfile;
    const userId = get().currentUserId;
    if (profile && userId && profile.peerId !== peerId) {
      const updated = { ...profile, peerId };
      StorageManager.setUserProfile(updated, userId);
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
      const userId = get().currentUserId;
      if (!userId) {
        throw new Error('No user ID available');
      }
      
      const newContact: Contact = {
        peerId,
        name: name.trim(),
        addedAt: new Date(),
        isFavorite: false,
      };
      
      await StorageManager.addContact(newContact, userId);
      
      const contacts = get().contacts;
      const updated = [newContact, ...contacts.filter(c => c.peerId !== peerId)];
      set({ contacts: updated });
      
    } catch (error) {
      console.error('❌ Store: Failed to add contact:', error);
      set({ error: 'Failed to add contact' });
    }
  },
  
  removeContact: async (peerId: string) => {
    try {
      const userId = get().currentUserId;
      if (!userId) {
        throw new Error('No user ID available');
      }
      
      await StorageManager.removeContact(peerId, userId);
      
      const contacts = get().contacts;
      set({ contacts: contacts.filter(c => c.peerId !== peerId) });
      
    } catch (error) {
      console.error(' Store: Failed to remove contact:', error);
    }
  },
  
  updateContact: async (peerId: string, updates: Partial<Contact>) => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      const contacts = get().contacts;
      const updated = contacts.map(c => 
        c.peerId === peerId ? { ...c, ...updates } : c
      );
      
      const updatedContact = updated.find(c => c.peerId === peerId);
      if (updatedContact) {
        await StorageManager.addContact(updatedContact, userId);
        set({ contacts: updated });
      }
    } catch (error) {
      console.error(' Store: Failed to update contact:', error);
    }
  },
  
  toggleContactFavorite: async (peerId: string) => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      await StorageManager.toggleContactFavorite(peerId, userId);
      await get().loadContacts();
    } catch (error) {
      console.error(' Store: Failed to toggle favorite:', error);
    }
  },
  
  loadContacts: async () => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      const contacts = await StorageManager.getContacts(userId);
      set({ contacts });
    } catch (error) {
      console.error(' Store: Failed to load contacts:', error);
    }
  },
  
  
  setIncomingCall: (call: IncomingCall) => {
    set({
      callState: {
        ...get().callState,
        isIncomingCall: true,
        currentCall: call,
      }
    });
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
      
      const userId = get().currentUserId;
      if (userId) {
        await StorageManager.updateLastCall(callState.currentCall.callerPeerId, userId);
      }
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
  },
  
  startOutgoingCall: (targetPeerId: string, callType: 'video' | 'audio' = 'video') => {
    const contact = get().contacts.find(c => c.peerId === targetPeerId);
    get().addCallToHistory({
      peerId: targetPeerId,
      name: contact?.name || 'Unknown',
      type: 'outgoing',
      callType,
      timestamp: new Date(),
    });
  },
  
  setActiveMediaCall: (call: any) => set({ activeMediaCall: call }),

  setCallConnected: () => {
    const callState = get().callState;
    set({
      callState: {
        ...callState,
        isInCall: true,
        callStartTime: new Date(),
        callDuration: 0,
      }
    });
    console.log(' Store: Call marked as connected, timer started');
  },
  
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
      const userId = get().currentUserId;
      if (!userId) return;
      
      await StorageManager.addCallToHistory(call, userId);
      
      const history = get().callHistory;
      const newCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...call
      };
      set({ callHistory: [newCall, ...history].slice(0, 50) });
    } catch (error) {
      console.error(' Store: Failed to add call to history:', error);
    }
  },

  updateCallHistory: async (peerId: string, updates: Partial<Pick<CallHistory, 'name' | 'duration' | 'type'>>) => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;

      const history = get().callHistory;
      const updatedHistory = history.map(call => {
        if (call.peerId === peerId && 
            (call.name === 'Calling...' || updates.duration !== undefined)) {
          return { ...call, ...updates };
        }
        return call;
      });

      set({ callHistory: updatedHistory });
      
      await StorageManager.updateCallHistory(userId, peerId, updates);
    } catch (error) {
      console.error(' Store: Failed to update call history:', error);
    }
  },
  
  loadCallHistory: async () => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      const history = await StorageManager.getCallHistory(userId);
      set({ callHistory: history });
    } catch (error) {
      console.error(' Store: Failed to load call history:', error);
    }
  },
  
  clearCallHistory: async () => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      await StorageManager.clearCallHistory(userId);
      set({ callHistory: [] });
    } catch (error) {
      console.error(' Store: Failed to clear call history:', error);
    }
  },
  
  setCurrentMeeting: (meeting: Meeting | null) => set({ currentMeeting: meeting }),
  
  addParticipant: (participant: Participant) => set((state) => ({
    participants: [...state.participants, participant]
  })),
  
  removeParticipant: (participantId: string) => set((state) => ({
    participants: state.participants.filter(p => p.id !== participantId)
  })),
  
  updateParticipant: (participantId: string, updates: Partial<Participant>) => set((state) => ({
    participants: state.participants.map(p => 
      p.id === participantId ? { ...p, ...updates } : p
    )
  })),
  
  setCurrentUser: (user: Participant) => set({ currentUser: user }),
  
  addMessage: (message: ChatMessage) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  toggleChat: () => set((state) => ({ 
    isChatOpen: !state.isChatOpen 
  })),
  
  toggleAudio: () => {
    const isAudioMuted = !get().isAudioMuted;
    set({ isAudioMuted });
  },
  
  toggleVideo: () => {
    const isVideoMuted = !get().isVideoMuted;
    set({ isVideoMuted });
  },
  
  toggleScreenShare: () => {
    const isScreenSharing = !get().isScreenSharing;
    set({ isScreenSharing });
  },
  
  setLocalStream: (stream: MediaStream | null) => set({ localStream: stream }),
  setScreenStream: (stream: MediaStream | null) => set({ screenStream: stream }),
  
  
  toggleParticipantsList: () => set((state) => ({ 
    isParticipantsListOpen: !state.isParticipantsListOpen 
  })),
  
  toggleSettings: () => set((state) => ({ 
    isSettingsOpen: !state.isSettingsOpen 
  })),
  
  
  updateUserPreferences: async (prefs: Partial<UserPreferences>) => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      const current = get().userPreferences;
      const updated = { ...current, ...prefs };
      
      await StorageManager.setUserPreferences(updated, userId);
      set({ userPreferences: updated });
    } catch (error) {
      console.error(' Store: Failed to update preferences:', error);
    }
  },
  
  updateDeviceSettings: async (settings: Partial<DeviceSettings>) => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      const current = get().deviceSettings;
      const updated = { ...current, ...settings };
      
      await StorageManager.setDeviceSettings(updated, userId);
      set({ deviceSettings: updated });
    } catch (error) {
      console.error(' Store: Failed to update device settings:', error);
    }
  },
  
  // ===== RECENT ROOMS =====
  
  addRecentRoom: async (roomId: string, roomName?: string) => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      await StorageManager.addToRecentRooms(roomId, userId, roomName);
      const rooms = await StorageManager.getRecentRooms(userId);
      set({ recentRooms: rooms });
    } catch (error) {
      console.error(' Store: Failed to add recent room:', error);
    }
  },
  
  clearRecentRooms: async () => {
    try {
      const userId = get().currentUserId;
      if (!userId) return;
      
      await StorageManager.clearRecentRooms(userId);
      set({ recentRooms: [] });
    } catch (error) {
      console.error(' Store: Failed to clear recent rooms:', error);
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
      const userId = get().currentUserId;
      if (!userId) return;
      
      await StorageManager.clearAllData(userId);

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
    } catch (error) {
      console.error(' Store: Failed to clear all data:', error);
    }
  },
}));