'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useMeetingStore } from '@/store/meeting';
import { usePeer } from '@/context/peer-context';
import { MessageCircle, MessageCircleOff } from 'lucide-react';

export const ChatToggleButton: React.FC = () => {
  const { 
    isChatOpen, 
    messages, 
    toggleChat 
  } = useMeetingStore();
  
  const { status } = usePeer();
  
  const isInCall = status.type === 'in_call' || status.type === 'calling_peer';
  const unreadCount = messages.length;
  
  if (!isInCall) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Button
        onClick={toggleChat}
        className={`relative rounded-full w-14 h-14 shadow-lg transition-all duration-300 ${
          isChatOpen 
            ? 'bg-blue-500 hover:bg-blue-600' 
            : 'bg-gray-600 hover:bg-gray-700'
        }`}
        title={isChatOpen ? 'Close Chat' : 'Open Chat'}
      >
        {isChatOpen ? (
          <MessageCircleOff className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
        
        {/* Unread Messages Badge */}
        {unreadCount > 0 && !isChatOpen && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-semibold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </Button>
    </div>
  );
};

export default ChatToggleButton;
