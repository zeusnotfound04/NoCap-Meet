import localforage from "localforage";
import { UserProfile , Contact } from "@/types/calling";

localforage.config({
    driver : [
        localforage.INDEXEDDB,
        localforage.WEBSQL,
        localforage.LOCALSTORAGE
    ],
    name : "Nocap-meet",
    version: 1.0,
   size: 4980736, // 5 MB
   storeName: "nocap-meet-data",
   description : "direct baat cheet ladle"
})


export const STORAGE_KEYS = {
    USER_PROFILE : "user-profile",
    CONTACTS: "contacts",
    CALL_HISTORY : "call_history",
    USER_PREFERENCES : "user_preferences",
    RECENT_ROOMS : "recent-rooms",
    DEVICE_SETTINGS : "device-settings"
} as const



export class StorageManager {
    
    static async initializeStorage(): Promise<void> {
    try {
      const profile = await this.getUserProfile();
      if (!profile) {
        
        await this.setUserPreferences({
          theme: 'light',
          notifications: true,
          autoAcceptCalls: false,
          defaultCallType: 'video',
          soundEnabled: true,
        });

        await this.setDeviceSettings({
          videoQuality: 'medium',
          audioQuality: 'high',
        });

        console.log(' Storage initialized with defaults');
      }
    } catch (error) {
      console.error(' Failed to initialize storage:', error);
    }
  }
    static async setUserProfile(profile : UserProfile) : Promise<void> {
        try {
            await localforage.setItem(STORAGE_KEYS.USER_PROFILE, profile)
            console.log("PROFILE SAVED !" , profile)
        } catch (err) {
            console.error("Error while storing the user profile" , err)
            throw err;
        }
    }

    static async getUserProfile(): Promise<UserProfile | null> {
        try {
            const profile = await localforage.getItem<UserProfile>(STORAGE_KEYS.USER_PROFILE);
            return profile;
        } catch (err) {
            console.error("Error While getting the user profile" , err)
            return null
        }
    }

    static async updateUserStatus(status : UserProfile['status']): Promise<void>{
        try{
            const profile = await this.getUserProfile();
            if(profile){
                profile.status = status;
                profile.lastSeen= new Date();
                await this.setUserProfile(profile);
                console.log("Status updated" , status) 
            }

        } catch (err){
            console.error("Failed to update user status " , err)
        }
    }

    static async updatePeerId(peerId : string) : Promise<void> {
        try{
            const profile = await this.getUserProfile();
            if(profile){
                profile.peerId = peerId
                await this.setUserProfile(profile)
                console.log("Peer ID updated to" , peerId)
            }
        } catch (err) {
            console.log("Failed to update the peerId " , peerId)
        }
    }
     static async getContacts(): Promise<Contact[]> {
    try {
      const contacts = await localforage.getItem<Contact[]>(STORAGE_KEYS.CONTACTS);
      return contacts || [];
    } catch (error) {
      console.error(' Failed to get contacts:', error);
      return [];
    }
  }
    static async addContact(contact: Contact): Promise<void> {
    try {
      const contacts = await this.getContacts();
      
      const existingIndex = contacts.findIndex(c => c.peerId === contact.peerId);
      
      if (existingIndex >= 0) {
        contacts[existingIndex] = { ...contacts[existingIndex], ...contact };
        console.log(` Contact updated: ${contact.name}`);
      } else {
        contacts.unshift(contact); 
        console.log(` Contact added: ${contact.name}`);
      }
      
      await localforage.setItem(STORAGE_KEYS.CONTACTS, contacts);
    } catch (error) {
      console.error(' Failed to add contact:', error);
      throw error;
    }
  }

   static async removeContact(peerId: string): Promise<void> {
    try {
      const contacts = await this.getContacts();
      const filtered = contacts.filter(c => c.peerId !== peerId);
      await localforage.setItem(STORAGE_KEYS.CONTACTS, filtered);
      console.log(` Contact removed: ${peerId}`);
    } catch (error) {
      console.error(' Failed to remove contact:', error);
      throw error;
    }
  }
static async updateLastCall(peerId: string): Promise<void> {
    try {
      const contacts = await this.getContacts();
      const updated = contacts.map(contact => 
        contact.peerId === peerId 
          ? { ...contact, lastCallAt: new Date() }
          : contact
      );
      await localforage.setItem(STORAGE_KEYS.CONTACTS, updated);
      console.log(` Last call updated for: ${peerId}`);
    } catch (error) {
      console.error(' Failed to update last call:', error);
    }
  }
   static async toggleContactFavorite(peerId: string): Promise<void> {
    try {
      const contacts = await this.getContacts();
      const updated = contacts.map(contact => 
        contact.peerId === peerId 
          ? { ...contact, isFavorite: !contact.isFavorite }
          : contact
      );
      await localforage.setItem(STORAGE_KEYS.CONTACTS, updated);
      console.log(` Favorite toggled for: ${peerId}`);
    } catch (error) {
      console.error(' Failed to toggle favorite:', error);
    }
  }
    static async getCallHistory(): Promise<any[]> {
    try {
      const history = await localforage.getItem<any[]>(STORAGE_KEYS.CALL_HISTORY);
      return history || [];
    } catch (error) {
      console.error(' Failed to get call history:', error);
      return [];
    }
  }

   static async addCallToHistory(call: {
    peerId: string;
    name: string;
    type: 'incoming' | 'outgoing' | 'missed';
    callType: 'video' | 'audio';
    duration?: number;
    timestamp: Date;
  }): Promise<void> {
    try {
      const history = await this.getCallHistory();
      const newCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...call
      };
      
      const updated = [newCall, ...history].slice(0, 100);
      await localforage.setItem(STORAGE_KEYS.CALL_HISTORY, updated);
      console.log(` Call added to history: ${call.type} ${call.callType} call`);
    } catch (error) {
      console.error(' Failed to add call to history:', error);
    }
  }
   static async clearCallHistory(): Promise<void> {
    try {
      await localforage.removeItem(STORAGE_KEYS.CALL_HISTORY);
      console.log(' Call history cleared');
    } catch (error) {
      console.error(' Failed to clear call history:', error);
    }
  }

    static async getUserPreferences(): Promise<any> {
    try {
      const preferences = await localforage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return preferences || {
        theme: 'light',
        notifications: true,
        autoAcceptCalls: false,
        defaultCallType: 'video',
        soundEnabled: true,
      };
    } catch (error) {
      console.error(' Failed to get user preferences:', error);
      return {
        theme: 'light',
        notifications: true,
        autoAcceptCalls: false,
        defaultCallType: 'video',
        soundEnabled: true,
      };
    }
  }
   static async setUserPreferences(preferences: {
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean;
    autoAcceptCalls?: boolean;
    defaultCallType?: 'video' | 'audio';
    soundEnabled?: boolean;
  }): Promise<void> {
    try {
      const existing = await this.getUserPreferences();
      const updated = { ...existing, ...preferences };
      await localforage.setItem(STORAGE_KEYS.USER_PREFERENCES, updated);
      console.log(' User preferences saved');
    } catch (error) {
      console.error(' Failed to save user preferences:', error);
    }
  }
  static async getRecentRooms(): Promise<Array<{
    roomId: string;
    roomName: string;
    lastJoined: string;
    participants: number;
  }>> {
    try {
      const rooms = await localforage.getItem<any[]>(STORAGE_KEYS.RECENT_ROOMS);
      return rooms || [];
    } catch (error) {
      console.error(' Failed to get recent rooms:', error);
      return [];
    }
  }
static async addToRecentRooms(roomId: string, roomName?: string): Promise<void> {
    try {
      const recent = await this.getRecentRooms();
      const newEntry = { 
        roomId, 
        roomName: roomName || `Room ${roomId.slice(0, 6)}`, 
        lastJoined: new Date().toISOString(),
        participants: 0 
      };
      const filtered = recent.filter(r => r.roomId !== roomId);
      const updated = [newEntry, ...filtered].slice(0, 10); // Keep last 10 rooms
      
      await localforage.setItem(STORAGE_KEYS.RECENT_ROOMS, updated);
      console.log(` Room added to recent: ${roomId}`);
    } catch (error) {
      console.error(' Failed to add recent room:', error);
    }
  }
    static async clearRecentRooms(): Promise<void> {
    try {
      await localforage.removeItem(STORAGE_KEYS.RECENT_ROOMS);
      console.log(' Recent rooms cleared');
    } catch (error) {
      console.error(' Failed to clear recent rooms:', error);
    }
  }
  static async setDeviceSettings(settings: {
    preferredCamera?: string;
    preferredMicrophone?: string;
    preferredSpeaker?: string;
    videoQuality?: 'low' | 'medium' | 'high';
    audioQuality?: 'low' | 'medium' | 'high';
  }): Promise<void> {
    try {
      const existing = await this.getDeviceSettings();
      const updated = { ...existing, ...settings };
      await localforage.setItem(STORAGE_KEYS.DEVICE_SETTINGS, updated);
      console.log(' Device settings saved');
    } catch (error) {
      console.error(' Failed to save device settings:', error);
    }
  }

  static async getDeviceSettings(): Promise<any> {
    try {
      const settings = await localforage.getItem(STORAGE_KEYS.DEVICE_SETTINGS);
      return settings || {
        preferredCamera: null,
        preferredMicrophone: null,
        preferredSpeaker: null,
        videoQuality: 'medium',
        audioQuality: 'high',
      };
    } catch (error) {
      console.error(' Failed to get device settings:', error);
      return {
        preferredCamera: null,
        preferredMicrophone: null,
        preferredSpeaker: null,
        videoQuality: 'medium',
        audioQuality: 'high',
      };
    }
  }

  static async getStorageInfo(): Promise<{
    keys: string[];
    usage: { [key: string]: number };
    totalSize: number;
  }> {
    try {
      const keys = await localforage.keys();
      const usage: { [key: string]: number } = {};
      let totalSize = 0;

      for (const key of keys) {
        const item = await localforage.getItem(key);
        const size = new Blob([JSON.stringify(item)]).size;
        usage[key] = size;
        totalSize += size;
      }

      return { keys, usage, totalSize };
    } catch (error) {
      console.error('❌ Failed to get storage info:', error);
      return { keys: [], usage: {}, totalSize: 0 };
    }
  }

  static async exportAllData(): Promise<any> {
    try {
      const data: any = {};
      const keys = await localforage.keys();
      
      for (const key of keys) {
        data[key] = await localforage.getItem(key);
      }
      
      console.log('✅ Data exported successfully');
      return data;
    } catch (error) {
      console.error('❌ Failed to export data:', error);
      return {};
    }
  }

  static async importAllData(data: any): Promise<void> {
    try {
      for (const [key, value] of Object.entries(data)) {
        await localforage.setItem(key, value);
      }
      console.log(' Data imported successfully');
    } catch (error) {
      console.error(' Failed to import data:', error);
      throw error;
    }
  }

  static async clearAllData(): Promise<void> {
    try {
      await localforage.clear();
      console.log(' All data cleared');
    } catch (error) {
      console.error(' Failed to clear all data:', error);
      throw error;
    }
  }


  
}