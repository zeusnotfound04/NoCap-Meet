
export const STORAGE_KEYS = {
    USER_PROFILE: "nocap-meet-user-profile",
    CONTACTS: "nocap-meet-contacts",
    CALL_HISTORY: "nocap-meet-call_history",
    USER_PREFERENCES: "nocap-meet-user_preferences",
    RECENT_ROOMS: "nocap-meet-recent-rooms",
    DEVICE_SETTINGS: "nocap-meet-device-settings"
} as const;

export const createKey = (userId: string, key: string): string => {
  return `nocap-meet:${userId}:${key}`;
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface StorageAvailability {
  available: boolean;
  driver: string;
  connected?: boolean;
  error?: string;
}

export interface StorageInfo {
  keys: string[];
  usage: { [key: string]: number };
  totalSize: number;
}
