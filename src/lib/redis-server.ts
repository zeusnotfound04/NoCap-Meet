import Redis from "ioredis";
import { UserProfile, Contact } from "@/types/calling";

interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}



let isRedisConfigured = false;
let redisClient: Redis | null = null;

const configureRedis = (): boolean => {
  if (redisClient && isRedisConfigured) {
    return true;
  }

  try {
    redisClient = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      isRedisConfigured = true;
    });

    redisClient.on('error', (error: any) => {
      console.error(' Redis connection error:', error);
      isRedisConfigured = false;
    });

    redisClient.on('close', () => {
      console.log('🔌 Redis connection closed');
      isRedisConfigured = false;
    });

    console.log(' Redis client configured successfully');
    return true;
  } catch (error) {
    console.error(" Redis configuration error:", error);
    return false;
  }
};

export const STORAGE_KEYS = {
    USER_PROFILE: "nocap-meet-user-profile",
    CONTACTS: "nocap-meet-contacts",
    CALL_HISTORY: "nocap-meet-call_history",
    USER_PREFERENCES: "nocap-meet-user_preferences",
    RECENT_ROOMS: "nocap-meet-recent-rooms",
    DEVICE_SETTINGS: "nocap-meet-device-settings"
} as const;

// Helper function to create namespaced keys
const createKey = (userId: string, key: string): string => {
  return `nocap-meet:${userId}:${key}`;
};

export class RedisStorageManager {
    
  static async initializeStorage(config?: RedisConfig): Promise<void> {
    console.log('🔧 RedisStorageManager: Starting Redis initialization...');

    if (!configureRedis()) {
      throw new Error('Failed to configure Redis client');
    }

    try {
      console.log('⏳ Connecting to Redis...');

      if (!redisClient) {
        throw new Error('Redis client not initialized');
      }

      // Connect to Redis with timeout
      await Promise.race([
        redisClient.connect(),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
        })
      ]);

      console.log('✅ Redis connection established');

      // Test basic Redis operations
      const testKey = 'nocap-meet:test:_test_key';
      const testValue = JSON.stringify({ test: 'test_value' });

      await redisClient.set(testKey, testValue, 'EX', 60); // Expire in 60 seconds
      const retrievedValue = await redisClient.get(testKey);
      await redisClient.del(testKey);

      if (retrievedValue !== testValue) {
        throw new Error('Redis test failed: Values do not match');
      }

      console.log(' Redis test passed and functional');

    } catch (error) {
      console.error(' Redis initialization failed:', error);
      throw new Error(`Redis initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Alternative initialization method that's more forgiving
  static async initializeStorageGraceful(config?: RedisConfig): Promise<boolean> {
    try {
      configureRedis();

      if (!redisClient) {
        console.error(' Redis client not available');
        return false;
      }

      await redisClient.ping();

      const testKey = 'nocap-meet:test:_quick_test';
      const testValue = JSON.stringify({ test: 'test' });
      
      await redisClient.set(testKey, testValue, 'EX', 30);
      const result = await redisClient.get(testKey);
      await redisClient.del(testKey);
      
      const success = result === testValue;
      console.log(success ? ' Redis initialized gracefully' : ' Redis test failed');
      return success;
    } catch (error) {
      console.error(' Graceful Redis init failed:', error);
      return false;
    }
  }

  static async checkStorageAvailability(): Promise<{
    available: boolean;
    driver: string;
    error?: string;
  }> {
    try {
      if (!redisClient) {
        return {
          available: false,
          driver: 'redis',
          error: 'Redis client not initialized'
        };
      }

      const testKey = 'nocap-meet:test:_availability_test';
      const testValue = JSON.stringify({ test: 'test' });
      
      await redisClient.set(testKey, testValue, 'EX', 30);
      const result = await redisClient.get(testKey);
      await redisClient.del(testKey);
      
      if (result === testValue) {
        return {
          available: true,
          driver: 'redis'
        };
      } else {
        throw new Error('Redis test failed');
      }
    } catch (error) {
      return {
        available: false,
        driver: 'redis',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  private static async ensureRedisReady(): Promise<boolean> {
    try {
      if (!isRedisConfigured || !redisClient) {
        const success = await this.initializeStorageGraceful();
        if (!success) {
          console.warn(' Redis not ready, operations may fail');
          return false;
        }
      }
      
      // Quick ping to ensure connection is alive
      await redisClient!.ping();
      return true;
    } catch (error) {
      console.error(' Failed to ensure Redis ready:', error);
      return false;
    }
  }

  static async setUserProfile(profile: UserProfile, userId: string): Promise<void> {
    try {
      await this.ensureRedisReady();
      if (!redisClient) throw new Error('Redis client not available');
      
      const key = createKey(userId, STORAGE_KEYS.USER_PROFILE);
      await redisClient.set(key, JSON.stringify(profile));
    } catch (err) {
      console.error(" Error while storing the user profile", err);
      throw err;
    }
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('🔍 RedisStorageManager: Getting user profile...');
      await this.ensureRedisReady();
      if (!redisClient) throw new Error('Redis client not available');
      
      const key = createKey(userId, STORAGE_KEYS.USER_PROFILE);
      const profileData = await redisClient.get(key);
      
      if (!profileData) {
        console.log(' RedisStorageManager: No user profile found');
        return null;
      }
      
      const profile = JSON.parse(profileData) as UserProfile;
      return profile;
    } catch (err) {
      console.error(" Error While getting the user profile", err);
      return null;
    }
  }

  static async updateUserStatus(status: UserProfile['status'], userId: string): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      if (profile) {
        profile.status = status;
        profile.lastSeen = new Date();
        await this.setUserProfile(profile, userId);
      }
    } catch (err) {
      console.error("Failed to update user status", err);
    }
  }

  static async updatePeerId(peerId: string, userId: string): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      if (profile) {
        profile.peerId = peerId;
        await this.setUserProfile(profile, userId);
      }
    } catch (err) {
      console.error("Failed to update the peerId", err);
    }
  }

  static async getContacts(userId: string): Promise<Contact[]> {
    try {
      await this.ensureRedisReady();
      if (!redisClient) throw new Error('Redis client not available');
      
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      const contactsData = await redisClient.get(key);
      
      if (!contactsData) {
        console.log(' RedisStorageManager: No contacts found');
        return [];
      }
      
      const contacts = JSON.parse(contactsData) as Contact[];
      return contacts || [];
    } catch (error) {
      console.error('❌ Failed to get contacts:', error);
      return [];
    }
  }

  static async addContact(contact: Contact, userId: string): Promise<void> {
    try {
      const contacts = await this.getContacts(userId);
      
      const existingIndex = contacts.findIndex(c => c.peerId === contact.peerId);
      
      if (existingIndex >= 0) {
        contacts[existingIndex] = { ...contacts[existingIndex], ...contact };
        console.log(`Contact updated: ${contact.name}`);
      } else {
        contacts.unshift(contact);
        console.log(`Contact added: ${contact.name}`);
      }
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await redisClient.set(key, JSON.stringify(contacts));
    } catch (error) {
      console.error('Failed to add contact:', error);
      throw error;
    }
  }

  static async removeContact(peerId: string, userId: string): Promise<void> {
    try {
      const contacts = await this.getContacts(userId);
      const filtered = contacts.filter(c => c.peerId !== peerId);
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await redisClient.set(key, JSON.stringify(filtered));
      console.log(`Contact removed: ${peerId}`);
    } catch (error) {
      console.error('Failed to remove contact:', error);
      throw error;
    }
  }

  static async updateLastCall(peerId: string, userId: string): Promise<void> {
    try {
      const contacts = await this.getContacts(userId);
      const updated = contacts.map(contact =>
        contact.peerId === peerId
          ? { ...contact, lastCallAt: new Date() }
          : contact
      );
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await redisClient.set(key, JSON.stringify(updated));
      console.log(`Last call updated for: ${peerId}`);
    } catch (error) {
      console.error('Failed to update last call:', error);
    }
  }

  static async toggleContactFavorite(peerId: string, userId: string): Promise<void> {
    try {
      const contacts = await this.getContacts(userId);
      const updated = contacts.map(contact =>
        contact.peerId === peerId
          ? { ...contact, isFavorite: !contact.isFavorite }
          : contact
      );
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await redisClient.set(key, JSON.stringify(updated));
      console.log(`Favorite toggled for: ${peerId}`);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }

  static async getCallHistory(userId: string): Promise<any[]> {
    try {
      await this.ensureRedisReady();
      if (!redisClient) throw new Error('Redis client not available');
      
      const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
      const historyData = await redisClient.get(key);
      
      if (!historyData) return [];
      
      return JSON.parse(historyData) as any[];
    } catch (error) {
      console.error('Failed to get call history:', error);
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
  }, userId: string): Promise<void> {
    try {
      const history = await this.getCallHistory(userId);
      const newCall = {
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...call
      };
      
      const updated = [newCall, ...history].slice(0, 100);
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
      await redisClient.set(key, JSON.stringify(updated));
      console.log(`Call added to history: ${call.type} ${call.callType} call`);
    } catch (error) {
      console.error('Failed to add call to history:', error);
    }
  }

  static async updateCallHistory(userId: string, peerId: string, updates: {
    name?: string;
    duration?: number;
    type?: 'incoming' | 'outgoing' | 'missed';
  }): Promise<void> {
    try {
      const history = await this.getCallHistory(userId);
      let updated = false;
      
      const updatedHistory = history.map((call: any) => {
        if (call.peerId === peerId && 
            (call.name === 'Calling...' || updates.duration !== undefined)) {
          updated = true;
          return { ...call, ...updates };
        }
        return call;
      });

      if (updated) {
        if (!redisClient) throw new Error('Redis client not available');
        const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
        await redisClient.set(key, JSON.stringify(updatedHistory));
        console.log(`Call history updated for ${peerId}:`, updates);
      }
    } catch (error) {
      console.error('Failed to update call history:', error);
    }
  }

  static async clearCallHistory(userId: string): Promise<void> {
    try {
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
      await redisClient.del(key);
      console.log('Call history cleared');
    } catch (error) {
      console.error('Failed to clear call history:', error);
    }
  }

  static async getUserPreferences(userId: string): Promise<any> {
    try {
      console.log('🔍 RedisStorageManager: Getting user preferences...');
      await this.ensureRedisReady();
      if (!redisClient) throw new Error('Redis client not available');
      
      const key = createKey(userId, STORAGE_KEYS.USER_PREFERENCES);
      const preferencesData = await redisClient.get(key);
      
      const defaultPreferences = {
        theme: 'light',
        notifications: true,
        autoAcceptCalls: false,
        defaultCallType: 'video',
        soundEnabled: true,
      };
      
      if (!preferencesData) {
        console.log(' RedisStorageManager: Using default preferences');
        return defaultPreferences;
      }
      
      const preferences = JSON.parse(preferencesData);
      console.log(' RedisStorageManager: User preferences retrieved:', !!preferences);
      return { ...defaultPreferences, ...preferences };
    } catch (error) {
      console.error('❌ Failed to get user preferences:', error);
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
  }, userId: string): Promise<void> {
    try {
      const existing = await this.getUserPreferences(userId);
      const updated = { ...existing, ...preferences };
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.USER_PREFERENCES);
      await redisClient.set(key, JSON.stringify(updated));
      console.log('User preferences saved');
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }

  static async getRecentRooms(userId: string): Promise<Array<{
    roomId: string;
    roomName: string;
    lastJoined: string;
    participants: number;
  }>> {
    try {
      await this.ensureRedisReady();
      if (!redisClient) throw new Error('Redis client not available');
      
      const key = createKey(userId, STORAGE_KEYS.RECENT_ROOMS);
      const roomsData = await redisClient.get(key);
      
      if (!roomsData) return [];
      
      return JSON.parse(roomsData) as any[];
    } catch (error) {
      console.error('Failed to get recent rooms:', error);
      return [];
    }
  }

  static async addToRecentRooms(roomId: string, userId: string, roomName?: string): Promise<void> {
    try {
      const recent = await this.getRecentRooms(userId);
      const newEntry = {
        roomId,
        roomName: roomName || `Room ${roomId.slice(0, 6)}`,
        lastJoined: new Date().toISOString(),
        participants: 0
      };
      const filtered = recent.filter(r => r.roomId !== roomId);
      const updated = [newEntry, ...filtered].slice(0, 10); // Keep last 10 rooms
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.RECENT_ROOMS);
      await redisClient.set(key, JSON.stringify(updated));
      console.log(`Room added to recent: ${roomId}`);
    } catch (error) {
      console.error('Failed to add recent room:', error);
    }
  }

  static async clearRecentRooms(userId: string): Promise<void> {
    try {
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.RECENT_ROOMS);
      await redisClient.del(key);
      console.log('Recent rooms cleared');
    } catch (error) {
      console.error('Failed to clear recent rooms:', error);
    }
  }

  static async setDeviceSettings(settings: {
    preferredCamera?: string;
    preferredMicrophone?: string;
    preferredSpeaker?: string;
    videoQuality?: 'low' | 'medium' | 'high';
    audioQuality?: 'low' | 'medium' | 'high';
  }, userId: string): Promise<void> {
    try {
      const existing = await this.getDeviceSettings(userId);
      const updated = { ...existing, ...settings };
      
      if (!redisClient) throw new Error('Redis client not available');
      const key = createKey(userId, STORAGE_KEYS.DEVICE_SETTINGS);
      await redisClient.set(key, JSON.stringify(updated));
      console.log('Device settings saved');
    } catch (error) {
      console.error('Failed to save device settings:', error);
    }
  }

  static async getDeviceSettings(userId: string): Promise<any> {
    try {
      await this.ensureRedisReady();
      if (!redisClient) throw new Error('Redis client not available');
      
      const key = createKey(userId, STORAGE_KEYS.DEVICE_SETTINGS);
      const settingsData = await redisClient.get(key);
      
      const defaultSettings = {
        preferredCamera: null,
        preferredMicrophone: null,
        preferredSpeaker: null,
        videoQuality: 'medium',
        audioQuality: 'high',
      };
      
      if (!settingsData) return defaultSettings;
      
      const settings = JSON.parse(settingsData);
      return { ...defaultSettings, ...settings };
    } catch (error) {
      console.error('Failed to get device settings:', error);
      return {
        preferredCamera: null,
        preferredMicrophone: null,
        preferredSpeaker: null,
        videoQuality: 'medium',
        audioQuality: 'high',
      };
    }
  }

  static async getStorageInfo(userId: string): Promise<{
    keys: string[];
    usage: { [key: string]: number };
    totalSize: number;
  }> {
    try {
      if (!redisClient) throw new Error('Redis client not available');
      
      const pattern = createKey(userId, '*');
      const keys = await redisClient.keys(pattern);
      const usage: { [key: string]: number } = {};
      let totalSize = 0;

      for (const key of keys) {
        const item = await redisClient.get(key);
        if (item) {
          const size = Buffer.byteLength(item, 'utf8');
          const cleanKey = key.replace(`nocap-meet:${userId}:`, '');
          usage[cleanKey] = size;
          totalSize += size;
        }
      }

      return { keys: keys.map((k: any) => k.replace(`nocap-meet:${userId}:`, '')), usage, totalSize };
    } catch (error) {
      console.error(' Failed to get storage info:', error);
      return { keys: [], usage: {}, totalSize: 0 };
    }
  }

  static async exportAllData(userId: string): Promise<any> {
    try {
      if (!redisClient) throw new Error('Redis client not available');
      
      const data: any = {};
      const pattern = createKey(userId, '*');
      const keys = await redisClient.keys(pattern);
      
      for (const key of keys) {
        const item = await redisClient.get(key);
        if (item) {
          const cleanKey = key.replace(`nocap-meet:${userId}:`, '');
          data[cleanKey] = JSON.parse(item);
        }
      }
      
      return data;
    } catch (error) {
      console.error(' Failed to export data:', error);
      return {};
    }
  }

  static async importAllData(data: any, userId: string): Promise<void> {
    try {
      if (!redisClient) throw new Error('Redis client not available');
      
      for (const [key, value] of Object.entries(data)) {
        const redisKey = createKey(userId, key);
        await redisClient.set(redisKey, JSON.stringify(value));
      }
      console.log('Data imported successfully');
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  static async clearAllData(userId: string): Promise<void> {
    try {
      if (!redisClient) throw new Error('Redis client not available');
      
      const pattern = createKey(userId, '*');
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      
      console.log('All user data cleared');
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    try {
      if (redisClient) {
        await redisClient.quit();
        console.log(' Redis connection closed gracefully');
      }
    } catch (error) {
      console.error(' Error while disconnecting from Redis:', error);
    }
  }

  static getRedisClient(): Redis | null {
    return redisClient;
  }

  static isConnected(): boolean {
    return isRedisConfigured && redisClient?.status === 'ready';
  }
}
