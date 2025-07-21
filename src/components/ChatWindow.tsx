'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useMeetingStore } from '@/store/meeting';
import { usePeer } from '@/context/peer-context';
import { 
  MessageCircle, 
  Send, 
  X, 
  Minimize2, 
  Maximize2,
  User,
  Clock
} from 'lucide-react';

interface ChatWindowProps {
  isMinimized?: boolean;
  onMinimize?: () => void;
  onClose?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  isMinimized = false, 
  onMinimize, 
  onClose 
}) => {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(!isMinimized);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { 
    messages, 
    userProfile,
    isChatOpen,
    toggleChat 
  } = useMeetingStore();
  
  const { 
    sendChatMessage, 
    isConnected,
    status 
  } = usePeer();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isExpanded) {
      scrollToBottom();
    }
  }, [messages, isExpanded]);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    const success = sendChatMessage(message.trim());
    if (success) {
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isInCall = status.type === 'in_call' || status.type === 'calling_peer';
  const canSendMessage = isConnected && isInCall;

  if (!isChatOpen) return null;

  return (
    <div className={`fixed transition-all duration-300 ease-in-out z-50 ${
      isExpanded 
        ? 'inset-x-4 bottom-4 top-20 md:bottom-4 md:right-4 md:top-auto md:left-auto md:w-96 md:h-[500px]' 
        : 'bottom-4 right-4 w-80 h-16'
    }`}>
      <Card className="h-full shadow-2xl border-2 border-blue-200 bg-white/95 backdrop-blur-sm">
        {/* Header */}
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <h3 className="font-semibold text-sm md:text-base">
                Chat {messages.length > 0 && `(${messages.length})`}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-colors"
                title={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleChat}
                className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-colors"
                title="Close Chat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Connection Status */}
          <div className="text-xs text-blue-100">
            {!isConnected ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Not Connected
              </span>
            ) : !isInCall ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                Not in Call
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                Chat Active
              </span>
            )}
          </div>
        </CardHeader>

        {/* Chat Content */}
        {isExpanded && (
          <CardContent className="p-0 flex flex-col h-full">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 md:space-y-3 min-h-0" 
                 style={{ 
                   maxHeight: 'calc(100vh - 200px)', 
                   WebkitOverflowScrolling: 'touch'
                 }}>
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8 px-4">
                  <MessageCircle className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {!isInCall ? 'Start a call to begin chatting' : 'Send a message to start the conversation'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {messages.map((msg) => {
                    const isOwnMessage = msg.senderId === userProfile?.peerId || 
                                      msg.senderName === userProfile?.name;
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-3 shadow-sm transition-all duration-200 hover:shadow-md ${
                            isOwnMessage
                              ? 'bg-blue-500 text-white rounded-br-md'
                              : 'bg-gray-100 text-gray-900 rounded-bl-md'
                          }`}
                        >
                          {!isOwnMessage && (
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-3 h-3" />
                              <span className="text-xs font-medium">
                                {msg.senderName}
                              </span>
                            </div>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                          <div className={`flex items-center gap-1 mt-2 ${
                            isOwnMessage ? 'justify-end' : 'justify-start'
                          }`}>
                            <Clock className="w-3 h-3 opacity-70" />
                            <span className={`text-xs opacity-70`}>
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 md:p-4 border-t bg-gray-50/90 backdrop-blur-sm">
              {canSendMessage ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      className="flex-1 rounded-full border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-sm md:text-base"
                      maxLength={500}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!message.trim()}
                      size="sm"
                      className="px-3 md:px-4 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors duration-200 shadow-md"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>Press Enter to send</span>
                    <span>{500 - message.length} characters left</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-500 py-3">
                  {!isConnected ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400"></span>
                      Connect to start chatting
                    </div>
                  ) : !isInCall ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                      Start a call to enable chat
                    </div>
                  ) : (
                    'Chat not available'
                  )}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ChatWindow;
