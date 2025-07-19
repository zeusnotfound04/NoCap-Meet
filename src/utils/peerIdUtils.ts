/**
 * Utility functions for peer ID generation and management
 */

export interface PeerIdInfo {
  currentId: string;
  nextChangeDate: Date;
  daysUntilChange: number;
  threeDayPeriod: number;
}

/**
 * Generate a peer ID that remains consistent for 3 days
 */
export function generateThreeDayPeerId(userName: string): string {
  const cleanName = userName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  const threeDayNumber = getThreeDayBasedNumber(cleanName);
  return `${cleanName}_${threeDayNumber}`;
}

/**
 * Get information about the current peer ID and when it will change
 */
export function getPeerIdInfo(userName: string): PeerIdInfo {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  
  const threeDayPeriod = Math.floor(dayOfYear / 3);
  const dayInCurrentPeriod = dayOfYear % 3;
  const daysUntilChange = 2 - dayInCurrentPeriod;
  
  // Calculate next change date
  const nextChangeDate = new Date(now);
  nextChangeDate.setDate(now.getDate() + daysUntilChange + 1);
  nextChangeDate.setHours(0, 0, 0, 0);
  
  const currentId = generateThreeDayPeerId(userName);
  
  return {
    currentId,
    nextChangeDate,
    daysUntilChange,
    threeDayPeriod
  };
}

/**
 * Generate consistent number for 3-day periods
 */
function getThreeDayBasedNumber(seed: string): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  
  // Create 3-day periods (0-2, 3-5, 6-8, etc.)
  const threeDayPeriod = Math.floor(dayOfYear / 3);
  
  // Use seed (name) to create more unique numbers for different names
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Combine period and hash to create 4-digit number
  const combinedNumber = (threeDayPeriod * 1000 + Math.abs(hash) % 1000) % 9000 + 1000;
  
  return combinedNumber;
}

/**
 * Format the next change date for display
 */
export function formatNextChangeDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  
  if (date.toDateString() === now.toDateString()) {
    return 'today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'tomorrow';
  } else {
    return date.toLocaleDateString();
  }
}
