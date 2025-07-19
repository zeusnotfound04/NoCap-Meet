'use client';

import { useEffect, useState } from 'react';
import { useMeetingStore } from '@/store/meeting';
import { usePeer } from '@/context/peer-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { CallInterface } from '@/components/CallInterface';
import { CallStatus } from '@/components/CallStatus';
import { getPeerIdInfo, formatNextChangeDate } from '@/utils/peerIdUtils';
import { 
  Video, 
  Phone, 
  Plus, 
  Copy, 
  User,
  Star,
  Trash2,
  Clock,
  Wifi,
  WifiOff,
  PhoneCall,
  Database,
  Info
} from 'lucide-react';

export default function NocapMeetHomePage() {
  const [userName, setUserName] = useState('');
  const [contactPeerId, setContactPeerId] = useState('');
  const [contactName, setContactName] = useState('');
  const [userIdInput, setUserIdInput] = useState(''); 
  const [isCustomUserId, setIsCustomUserId] = useState(false); 
  const [showPeerIdInfo, setShowPeerIdInfo] = useState(false); 

  const {
    userProfile,
    contacts,
    callHistory,
    currentUserId,
    initializeStore,
    initializeUser,
    setCurrentUserId,
    addContact,
    removeContact,
    isLoading: storeLoading,
    error: storeError,
  } = useMeetingStore();

  const {
    status: peerStatus,
    isConnected,
    myPeerId,
    makeCall,
    incomingCall,
    localStream,
    remoteStream,
    initializePeerWithName,
  } = usePeer();

  useEffect(() => {
    const initialize = async () => {
      try {
        
        await initializeStore();
        console.log('✅ Homepage: Store initialized with user ID:', currentUserId);
      } catch (error) {
        console.error(' Homepage: Failed to initialize store:', error);
      }
    };

    initialize();
  }, [initializeStore]);

  useEffect(() => {
    if (userProfile?.name) {
      setUserName(userProfile.name);
    }
  }, [userProfile]);

  const isAppReady = !storeLoading && peerStatus.type !== 'idle' && peerStatus.type !== 'waiting_for_name';
  
  const hasError = storeError || peerStatus.error;


  const handleUserSetup = async () => {
    if (userName.trim()) {
      console.log('🚀 Setting up user with name:', userName.trim());
      
      // Handle custom User ID if provided
      if (isCustomUserId && userIdInput.trim()) {
        const customUserId = userIdInput.trim();
        setCurrentUserId(customUserId);
        
        await initializeStore(customUserId);
      }
      
      await initializeUser(userName.trim());
      
      setTimeout(() => {
        initializePeerWithName(userName.trim());
      }, 100);
    }
  };

  const handleAddContact = async () => {
    if (contactPeerId.trim() && contactName.trim()) {
      await addContact(contactPeerId.trim(), contactName.trim());
      setContactPeerId('');
      setContactName('');
    }
  };

  const handleDirectCall = async (peerId: string, callType: 'video' | 'audio' = 'video') => {
    const success = await makeCall(peerId, callType);
    if (!success) {
      alert('Failed to make call. Please check the peer ID and try again.');
    }
  };

  const copyPeerId = () => {
    if (myPeerId) {
      navigator.clipboard.writeText(myPeerId);
      alert('📋 Call ID copied! Share this with friends so they can call you.');
    }
  };

  const copyUserId = () => {
    if (currentUserId) {
      navigator.clipboard.writeText(currentUserId);
      alert('📋 User ID copied! You can use this to access your data from other devices.');
    }
  };

  const handleRemoveContact = async (peerId: string) => {
    if (confirm('Remove this contact?')) {
      await removeContact(peerId);
    }
  };

  const handleSwitchUser = () => {
    if (confirm('Switch to a different user? This will reload your data.')) {
      setIsCustomUserId(true);
      setUserIdInput('');
    }
  };

  if (!isAppReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Setting up Nocap-Meet...</p>
          <p className="text-sm text-gray-500 mt-2">Direct baat cheet ladle</p>

        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <h2 className="text-xl font-bold text-red-600">Connection Error</h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{storeError || peerStatus.error}</p>
            <div className="text-sm text-gray-500 mb-4 space-y-1">
              <div>An error occurred while connecting to the service.</div>
            </div>
            <Button onClick={() => window.location.reload()}>
              Reload Nocap-Meet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Nocap-Meet
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Direct baat cheet ladle - One-on-one video calls
          </p>
          
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Connected & Ready</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-yellow-500" />
                  <span className="text-yellow-600">
                    {peerStatus.type === 'waiting_for_name' ? 'Ready to start...' : `Connecting... (${peerStatus.type})`}
                  </span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              <span className="text-blue-600">Redis Storage</span>
            </div>
          </div>
          
          {currentUserId && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
              <span>User ID: {currentUserId.slice(0, 16)}...</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyUserId}
                className="h-6 px-2 text-xs"
                title="Copy User ID"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSwitchUser}
                className="h-6 px-2 text-xs"
                title="Switch User"
              >
                Switch User
              </Button>
            </div>
          )}

        </header>

        <CallStatus />

        {!userProfile ? (
          <Card className="mb-8 max-w-md mx-auto">
            <CardHeader>
              <h2 className="text-xl font-bold flex items-center">
                <User className="w-5 h-5 mr-2" />
                Get Started
              </h2>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Enter your name to start making video calls
              </p>
              
              {!isCustomUserId ? (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 mb-2">
                    Using auto-generated User ID: {currentUserId?.slice(0, 16)}...
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCustomUserId(true)}
                    className="text-xs"
                  >
                    Use custom User ID instead
                  </Button>
                </div>
              ) : (
                <div className="mb-4 space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Custom User ID (to sync across devices):
                  </label>
                  <Input
                    placeholder="Enter your existing User ID"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCustomUserId(false);
                      setUserIdInput('');
                    }}
                    className="text-xs"
                  >
                    Use auto-generated ID instead
                  </Button>
                </div>
              )}
              
              <div className="space-y-3">
                <Input
                  placeholder="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUserSetup()}
                />
                <Button 
                  onClick={handleUserSetup} 
                  disabled={!userName.trim() || !isConnected}
                  className="w-full"
                >
                  {isConnected ? 'Start Calling' : `Connecting... (${peerStatus.type})`}
                </Button>
              </div>
              {!isConnected && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Waiting for peer connection...
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* User Dashboard */
          <>
            {/* User Info */}
            <Card className="mb-8">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {userProfile.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{userProfile.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className={`w-2 h-2 rounded-full ${
                          isConnected ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        {isConnected ? 'Online - Ready for calls' : `Connecting... (${peerStatus.type})`}
                      </div>
                      <div className="text-xs text-gray-400">
                        User ID: {currentUserId?.slice(0, 16)}...
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Your Call ID</p>
                      <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {myPeerId ? 
                          `${myPeerId.slice(0, 8)}...${myPeerId.slice(-4)}` 
                          : 'Generating...'
                        }
                      </p>
                      {userProfile?.name && myPeerId && (
                        <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          <span>
                            Valid for 3 days (changes {formatNextChangeDate(getPeerIdInfo(userProfile.name).nextChangeDate)})
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyPeerId}
                      disabled={!myPeerId}
                      title="Copy your Call ID"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Peer ID Information Card */}
            {userProfile?.name && myPeerId && (
              <Card className="mb-8">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      3-Day Peer ID System
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPeerIdInfo(!showPeerIdInfo)}
                    >
                      {showPeerIdInfo ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>
                  
                  {showPeerIdInfo && (
                    <div className="space-y-3 text-sm">
                      {(() => {
                        const peerInfo = getPeerIdInfo(userProfile.name);
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <p className="font-medium text-gray-700">Current Call ID:</p>
                                <p className="font-mono text-lg">{myPeerId}</p>
                              </div>
                              <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="font-medium text-blue-700">Valid Until:</p>
                                <p className="text-blue-600">
                                  {peerInfo.nextChangeDate.toLocaleDateString()} at midnight
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="bg-green-50 p-3 rounded-lg">
                                <p className="font-medium text-green-700">Days Remaining:</p>
                                <p className="text-green-600">
                                  {peerInfo.daysUntilChange} day{peerInfo.daysUntilChange !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="bg-yellow-50 p-3 rounded-lg">
                                <p className="font-medium text-yellow-700">Period #:</p>
                                <p className="text-yellow-600">{peerInfo.threeDayPeriod}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="bg-indigo-50 p-4 rounded-lg mt-4">
                        <p className="font-medium text-indigo-700 mb-2">How it works:</p>
                        <ul className="text-indigo-600 space-y-1 text-xs">
                          <li>• Your Call ID is generated from your name + a 3-day period number</li>
                          <li>• Everyone with the same name gets the same number for 3 days</li>
                          <li>• After 3 days, everyone gets a new number automatically</li>
                          <li>• This makes IDs memorable but prevents permanent conflicts</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Add Contact */}
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-bold flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    Add Contact
                  </h2>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Input
                      placeholder="Friend's Call ID"
                      value={contactPeerId}
                      onChange={(e) => setContactPeerId(e.target.value)}
                    />
                    <Input
                      placeholder="Friend's name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                    <Button 
                      onClick={handleAddContact}
                      disabled={!contactPeerId.trim() || !contactName.trim() || !isConnected}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                  </div>
                  
                  <div className="text-sm text-gray-500 p-3 bg-blue-50 rounded-lg">
                    <p className="font-medium mb-1">How to add friends:</p>
                    <p>1. Copy your Call ID above</p>
                    <p>2. Share it with your friend</p>
                    <p>3. Get their Call ID</p>
                    <p>4. Add them here to start calling!</p>
                    <p className="mt-2 text-xs text-blue-700">
                      💡 Call IDs stay the same for 3 days, making it easy to remember and share!
                    </p>
                  </div>
                  
                  <div className="text-sm text-green-600 p-3 bg-green-50 rounded-lg">
                    <p className="font-medium mb-1">✅ Redis Storage Active</p>
                    <p>Your contacts are synced across devices with your User ID!</p>
                  </div>
                </CardContent>
              </Card>

              {/* Contacts List */}
              <Card>
                <CardHeader>
                  <h3 className="text-xl font-bold flex items-center">
                    <PhoneCall className="w-5 h-5 mr-2" />
                    Your Contacts ({contacts.length})
                  </h3>
                </CardHeader>
                <CardContent>
                  {contacts.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {contacts.map((contact) => (
                        <div key={contact.peerId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-sm font-medium">
                              {contact.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-xs text-gray-500 font-mono">
                                {contact.peerId.slice(0, 8)}...{contact.peerId.slice(-4)}
                              </p>
                              {contact.lastCallAt && (
                                <p className="text-xs text-gray-400">
                                  Last call: {new Date(contact.lastCallAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            {contact.isFavorite && (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDirectCall(contact.peerId, 'audio')}
                              title="Audio call"
                              disabled={!isConnected || peerStatus.type === 'calling_peer' || peerStatus.type === 'in_call'}
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDirectCall(contact.peerId, 'video')}
                              title="Video call"
                              disabled={!isConnected || peerStatus.type === 'calling_peer' || peerStatus.type === 'in_call'}
                            >
                              <Video className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveContact(contact.peerId)}
                              title="Remove contact"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No contacts yet</p>
                      <p className="text-sm">Add friends to start calling!</p>
                      <p className="text-xs text-blue-600 mt-2">
                        Contacts are stored in Redis and sync across devices
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Call History */}
            {callHistory.length > 0 && (
              <Card className="mt-8">
                <CardHeader>
                  <h3 className="text-lg font-semibold flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Recent Calls
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {callHistory.slice(0, 5).map((call, index) => (
                      <div key={call.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 ${
                            call.type === 'missed' ? 'text-red-500' : 
                            call.type === 'outgoing' ? 'text-green-500' : 'text-blue-500'
                          }`}>
                            {call.callType === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium">{call.name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(call.timestamp).toLocaleDateString()} • {call.type}
                              {call.duration && ` • ${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDirectCall(call.peerId)}
                          title="Call back"
                          disabled={!isConnected || peerStatus.type === 'calling_peer' || peerStatus.type === 'in_call'}
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-blue-600 text-center">
                    Call history synced via Redis storage
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Video Elements for Calls */}
        <div className="hidden">
          <video id="local-video" autoPlay muted playsInline />
          <video id="remote-video" autoPlay playsInline />
        </div>
      </div>

      {/* Call-related Modals/Overlays */}
      <IncomingCallModal />
      <CallInterface />
    </div>
  );
}