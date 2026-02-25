import { create } from 'zustand';
import { ChatMessage } from '@/types/meeting';

interface MeetingStore {
  messages: ChatMessage[];
  isChatOpen: boolean;
  
  addMessage: (message: ChatMessage) => void;
  toggleChat: () => void;
  clearMessages: () => void;
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  messages: [],
  isChatOpen: false,
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  toggleChat: () => set((state) => ({
    isChatOpen: !state.isChatOpen
  })),
  
  clearMessages: () => set({
    messages: []
  }),
}));
