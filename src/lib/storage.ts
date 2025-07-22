import { UserProfile, Contact } from "@/types/calling";

export class StorageManager {
  
  private static async apiCall(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  static async initializeStorage(): Promise<void> {
    try {
      await this.apiCall('/storage/status');
      console.log('Storage connection verified');
    } catch (error) {
      console.error('Storage initialization failed:', error);
      throw error;
    }
  }

  static async initializeStorageGraceful(): Promise<boolean> {
    try {
      await this.initializeStorage();
      return true;
    } catch (error) {
      console.error('Graceful storage init failed:', error);
      return false;
    }
  }

  static async checkStorageAvailability(): Promise<{
    available: boolean;
    driver: string;
    error?: string;
  }> {
    try {
      const result = await this.apiCall('/storage/status');
      return result.data;
    } catch (error) {
      return {
        available: false,
        driver: 'api',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async setUserProfile(profile: UserProfile, userId: string): Promise<void> {
    try {
      await this.apiCall('/user/profile', {
        method: 'POST',
        body: JSON.stringify({ userId, profile }),
      });
    } catch (err) {
      console.error("Error while storing the user profile", err);
      throw err;
    }
  }

  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('StorageManager: Getting user profile...');
      const result = await this.apiCall(`/user/profile?userId=${userId}`);
      return result.data;
    } catch (err) {
      console.error("Error While getting the user profile", err);
      return null;
    }
  }

  static async updateUserStatus(status: UserProfile['status'], userId: string): Promise<void> {
    try {
      await this.apiCall('/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ userId, status }),
      });
    } catch (err) {
      console.error("Failed to update user status", err);
    }
  }

  static async updatePeerId(peerId: string, userId: string): Promise<void> {
    try {
      await this.apiCall('/user/profile/peer-id', {
        method: 'PATCH',
        body: JSON.stringify({ userId, peerId }),
      });
      console.log("Peer ID updated to", peerId);
    } catch (err) {
      console.error("Failed to update the peerId", err);
    }
  }

  static async getContacts(userId: string): Promise<Contact[]> {
    try {
      const result = await this.apiCall(`/contacts?userId=${userId}`);
      return result.data || [];
    } catch (error) {
      console.error('Failed to get contacts:', error);
      return [];
    }
  }

  static async addContact(contact: Contact, userId: string): Promise<void> {
    try {
      await this.apiCall('/contacts', {
        method: 'POST',
        body: JSON.stringify({ userId, contact }),
      });
      console.log(`Contact added: ${contact.name}`);
    } catch (error) {
      console.error('Failed to add contact:', error);
      throw error;
    }
  }

  static async removeContact(peerId: string, userId: string): Promise<void> {
    try {
      await this.apiCall('/contacts', {
        method: 'DELETE',
        body: JSON.stringify({ userId, peerId }),
      });
      console.log(`Contact removed: ${peerId}`);
    } catch (error) {
      console.error('Failed to remove contact:', error);
      throw error;
    }
  }

  static async updateLastCall(peerId: string, userId: string): Promise<void> {
    try {
      await this.apiCall('/contacts/last-call', {
        method: 'PATCH',
        body: JSON.stringify({ userId, peerId }),
      });
      console.log(`Last call updated for: ${peerId}`);
    } catch (error) {
      console.error('Failed to update last call:', error);
    }
  }

  static async toggleContactFavorite(peerId: string, userId: string): Promise<void> {
    try {
      await this.apiCall('/contacts/favorite', {
        method: 'PATCH',
        body: JSON.stringify({ userId, peerId }),
      });
      console.log(`Favorite toggled for: ${peerId}`);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }

  static async getCallHistory(userId: string): Promise<any[]> {
    try {
      const result = await this.apiCall(`/call-history?userId=${userId}`);
      return result.data || [];
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
      await this.apiCall('/call-history', {
        method: 'POST',
        body: JSON.stringify({ userId, call }),
      });
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
      await this.apiCall('/call-history', {
        method: 'PATCH',
        body: JSON.stringify({ userId, peerId, updates }),
      });
      console.log(`Call history updated for ${peerId}:`, updates);
    } catch (error) {
      console.error('Failed to update call history:', error);
    }
  }

  static async clearCallHistory(userId: string): Promise<void> {
    try {
      await this.apiCall('/call-history', {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });
      console.log('Call history cleared');
    } catch (error) {
      console.error('Failed to clear call history:', error);
    }
  }

  static async getUserPreferences(userId: string): Promise<any> {
    try {
      const result = await this.apiCall(`/user/preferences?userId=${userId}`);
      return result.data;
    } catch (error) {
      console.error('Failed to get user preferences:', error);
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
      await this.apiCall('/user/preferences', {
        method: 'POST',
        body: JSON.stringify({ userId, preferences }),
      });
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
      const result = await this.apiCall(`/recent-rooms?userId=${userId}`);
      return result.data || [];
    } catch (error) {
      console.error('Failed to get recent rooms:', error);
      return [];
    }
  }

  static async addToRecentRooms(roomId: string, userId: string, roomName?: string): Promise<void> {
    try {
      await this.apiCall('/recent-rooms', {
        method: 'POST',
        body: JSON.stringify({ userId, roomId, roomName }),
      });
    } catch (error) {
      console.error('Failed to add recent room:', error);
    }
  }

  static async clearRecentRooms(userId: string): Promise<void> {
    try {
      await this.apiCall('/recent-rooms', {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });
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
      await this.apiCall('/device-settings', {
        method: 'POST',
        body: JSON.stringify({ userId, settings }),
      });
    } catch (error) {
      console.error('Failed to save device settings:', error);
    }
  }

  static async getDeviceSettings(userId: string): Promise<any> {
    try {
      const result = await this.apiCall(`/device-settings?userId=${userId}`);
      return result.data;
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
      const result = await this.apiCall(`/storage/info?userId=${userId}`);
      return result.data;
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { keys: [], usage: {}, totalSize: 0 };
    }
  }

  static async exportAllData(userId: string): Promise<any> {
    try {
      const result = await this.apiCall(`/storage/export?userId=${userId}`);
      console.log('Data exported successfully');
      return result.data;
    } catch (error) {
      console.error('Failed to export data:', error);
      return {};
    }
  }

  static async importAllData(data: any, userId: string): Promise<void> {
    try {
      await this.apiCall('/storage/import', {
        method: 'POST',
        body: JSON.stringify({ userId, data }),
      });
      console.log('Data imported successfully');
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  static async clearAllData(userId: string): Promise<void> {
    try {
      await this.apiCall('/storage/clear', {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });
      console.log('All user data cleared');
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw error;
    }
  }

  static async disconnect(): Promise<void> {
    console.log('Client-side storage manager - no connection to close');
  }

  static getRedisClient(): null {
    console.warn('Redis client is not available on client-side');
    return null;
  }

  static isConnected(): boolean {
    return true;
  }
}