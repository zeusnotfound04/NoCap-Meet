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
const memoryStorage = new Map<string, string>();

const configureRedis = (): boolean => {
  if (redisClient && isRedisConfigured) {
    return true;
  }

  try {
    if (!process.env.REDIS_URL) {
      return false;
    }

    redisClient = new Redis(process.env.REDIS_URL!);

    redisClient.on('connect', () => {
      isRedisConfigured = true;
    });

    redisClient.on('ready', () => {
      isRedisConfigured = true;
    });

    redisClient.on('error', () => {
      isRedisConfigured = false;
    });

    redisClient.on('close', () => {
      isRedisConfigured = false;
    });

    redisClient.on('reconnecting', () => {
      isRedisConfigured = false;
    });

    return true;
  } catch (error) {
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

const createKey = (userId: string, key: string): string => {
  return `nocap-meet:${userId}:${key}`;
};

const getFromStorage = async (key: string): Promise<string | null> => {
  try {
    if (redisClient && isRedisConfigured && redisClient.status === 'ready') {
      return await redisClient.get(key);
    }
  } catch (error) {
  }
  return memoryStorage.get(key) || null;
};

const setToStorage = async (key: string, value: string, expireSeconds?: number): Promise<void> => {
  try {
    if (redisClient && isRedisConfigured && redisClient.status === 'ready') {
      if (expireSeconds) {
        await redisClient.set(key, value, 'EX', expireSeconds);
      } else {
        await redisClient.set(key, value);
      }
      return;
    }
  } catch (error) {
  }
  memoryStorage.set(key, value);
};

const deleteFromStorage = async (key: string): Promise<void> => {
  try {
    if (redisClient && isRedisConfigured && redisClient.status === 'ready') {
      await redisClient.del(key);
      return;
    }
  } catch (error) {
  }
  memoryStorage.delete(key);
};

export class RedisStorageManager {
    
  static async initializeStorage(config?: RedisConfig): Promise<void> {
    if (!configureRedis()) {
      throw new Error('Failed to configure Redis client');
    }

    try {
      if (!redisClient) {
        throw new Error('Redis client not initialized');
      }

      await Promise.race([
        redisClient.connect(),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
        })
      ]);

      const testKey = 'nocap-meet:test:_test_key';
      const testValue = JSON.stringify({ test: 'test_value' });

      await redisClient.set(testKey, testValue, 'EX', 60);
      const retrievedValue = await redisClient.get(testKey);
      await redisClient.del(testKey);

      if (retrievedValue !== testValue) {
        throw new Error('Redis test failed: Values do not match');
      }

    } catch (error) {
      throw new Error(`Redis initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async initializeStorageGraceful(config?: RedisConfig): Promise<boolean> {
    try {
      configureRedis();

      if (!redisClient) {
        return false;
      }

      await redisClient.ping();

      const testKey = 'nocap-meet:test:_quick_test';
      const testValue = JSON.stringify({ test: 'test' });
      
      await redisClient.set(testKey, testValue, 'EX', 30);
      const result = await redisClient.get(testKey);
      await redisClient.del(testKey);
      
      return result === testValue;
    } catch (error) {
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
          return false;
        }
      }
      
      const pingPromise = redisClient!.ping();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Ping timeout')), 2000);
      });

      await Promise.race([pingPromise, timeoutPromise]);
      return true;
    } catch (error) {
      return false;
    }
  }

  static async setUserProfile(profile: UserProfile, userId: string): Promise<void> {
    try {
      await this.ensureRedisReady();
      
      const key = createKey(userId, STORAGE_KEYS.USER_PROFILE);
      await setToStorage(key, JSON.stringify(profile));
    } catch (err) {
      throw err;
    }
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      await this.ensureRedisReady();
      
      const key = createKey(userId, STORAGE_KEYS.USER_PROFILE);
      const profileData = await getFromStorage(key);
      
      if (!profileData) {
        return null;
      }
      
      const profile = JSON.parse(profileData) as UserProfile;
      return profile;
    } catch (err) {
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
    }
  }

  static async getContacts(userId: string): Promise<Contact[]> {
    try {
      await this.ensureRedisReady();
      
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      const contactsData = await getFromStorage(key);
      
      if (!contactsData) {
        return [];
      }
      
      const contacts = JSON.parse(contactsData) as Contact[];
      return contacts || [];
    } catch (error) {
      return [];
    }
  }

  static async addContact(contact: Contact, userId: string): Promise<void> {
    try {
      const contacts = await this.getContacts(userId);
      
      const existingIndex = contacts.findIndex(c => c.peerId === contact.peerId);
      
      if (existingIndex >= 0) {
        contacts[existingIndex] = { ...contacts[existingIndex], ...contact };
      } else {
        contacts.unshift(contact);
      }
      
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await setToStorage(key, JSON.stringify(contacts));
    } catch (error) {
      throw error;
    }
  }

  static async removeContact(peerId: string, userId: string): Promise<void> {
    try {
      const contacts = await this.getContacts(userId);
      const filtered = contacts.filter(c => c.peerId !== peerId);
      
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await setToStorage(key, JSON.stringify(filtered));
    } catch (error) {
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
      
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await setToStorage(key, JSON.stringify(updated));
    } catch (error) {
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
      
      const key = createKey(userId, STORAGE_KEYS.CONTACTS);
      await setToStorage(key, JSON.stringify(updated));
    } catch (error) {
    }
  }

  static async getCallHistory(userId: string): Promise<any[]> {
    try {
      await this.ensureRedisReady();
      
      const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
      const historyData = await getFromStorage(key);
      
      if (!historyData) return [];
      
      return JSON.parse(historyData) as any[];
    } catch (error) {
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
      
      const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
      await setToStorage(key, JSON.stringify(updated));
    } catch (error) {
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
        const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
        await setToStorage(key, JSON.stringify(updatedHistory));
      }
    } catch (error) {
    }
  }

  static async clearCallHistory(userId: string): Promise<void> {
    try {
      const key = createKey(userId, STORAGE_KEYS.CALL_HISTORY);
      await deleteFromStorage(key);
    } catch (error) {
    }
  }

  static async getUserPreferences(userId: string): Promise<any> {
    try {
      await this.ensureRedisReady();
      
      const key = createKey(userId, STORAGE_KEYS.USER_PREFERENCES);
      const preferencesData = await getFromStorage(key);
      
      const defaultPreferences = {
        theme: 'light',
        notifications: true,
        autoAcceptCalls: false,
        defaultCallType: 'video',
        soundEnabled: true,
      };
      
      if (!preferencesData) {
        return defaultPreferences;
      }
      
      const preferences = JSON.parse(preferencesData);
      return { ...defaultPreferences, ...preferences };
    } catch (error) {
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
      
      const key = createKey(userId, STORAGE_KEYS.USER_PREFERENCES);
      await setToStorage(key, JSON.stringify(updated));
    } catch (error) {
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
      
      const key = createKey(userId, STORAGE_KEYS.RECENT_ROOMS);
      const roomsData = await getFromStorage(key);
      
      if (!roomsData) return [];
      
      return JSON.parse(roomsData) as any[];
    } catch (error) {
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
      const updated = [newEntry, ...filtered].slice(0, 10);
      
      const key = createKey(userId, STORAGE_KEYS.RECENT_ROOMS);
      await setToStorage(key, JSON.stringify(updated));
    } catch (error) {
    }
  }

  static async clearRecentRooms(userId: string): Promise<void> {
    try {
      const key = createKey(userId, STORAGE_KEYS.RECENT_ROOMS);
      await deleteFromStorage(key);
    } catch (error) {
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
      
      const key = createKey(userId, STORAGE_KEYS.DEVICE_SETTINGS);
      await setToStorage(key, JSON.stringify(updated));
    } catch (error) {
    }
  }

  static async getDeviceSettings(userId: string): Promise<any> {
    try {
      await this.ensureRedisReady();
      
      const key = createKey(userId, STORAGE_KEYS.DEVICE_SETTINGS);
      const settingsData = await getFromStorage(key);
      
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
    } catch (error) {
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
    } catch (error) {
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    try {
      if (redisClient) {
        await redisClient.quit();
      }
    } catch (error) {
    }
  }

  static getRedisClient(): Redis | null {
    return redisClient;
  }

  static isConnected(): boolean {
    return isRedisConfigured && redisClient?.status === 'ready';
  }
}