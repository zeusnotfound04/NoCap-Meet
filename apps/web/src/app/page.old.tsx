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
import { ChatWindow } from '@/components/ChatWindow';
import { ChatToggleButton } from '@/components/ChatToggleButton';
import BlurText from '@/components/ui/blur-effect';
import Squares from '@/components/ui/squre-background';
import { poppins, rocknRollOne, roboto } from '@/lib/fonts';
import { 
  Phone, 
  User,
  Wifi,
  WifiOff,
  Copy,
  Check
} from 'lucide-react';

export default function NocapMeetHomePage() {
  const [userName, setUserName] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [copied, setCopied] = useState(false);

  const {
    userProfile,
    currentUserId,
    initializeStore,
    initializeUser,
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
    console.log('[PAGE_DEBUG] Store initialization effect triggered');
    const initialize = async () => {
      try {
        console.log('[PAGE_DEBUG] Starting store initialization...');
        await initializeStore();
        console.log('[PAGE_DEBUG] Store initialization completed');
      } catch (error) {
        console.error('[PAGE_DEBUG] Failed to initialize store:', error);
      }
    };

    initialize();
  }, [initializeStore]);

  useEffect(() => {
    if (currentUserId) {
      console.log('[PAGE_DEBUG] Store initialized with user ID:', currentUserId);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (userProfile?.name) {
      console.log('[PAGE_DEBUG] User profile loaded:', userProfile.name);
      setUserName(userProfile.name);
    }
  }, [userProfile]);

  const isStoreReady = !storeLoading && !!currentUserId;
  const isPeerReady = peerStatus.type !== 'idle';
  const isAppReady = isStoreReady;
  const hasError = storeError || peerStatus.error;

  useEffect(() => {
    console.log('[PAGE_DEBUG] App state update:', {
      storeLoading,
      currentUserId,
      peerStatus: peerStatus.type,
      peerError: peerStatus.error,
      userProfile: !!userProfile,
      isStoreReady,
      isPeerReady,
      isAppReady,
      isConnected,
      hasError,
      timestamp: new Date().toISOString()
    });
  }, [storeLoading, currentUserId, peerStatus.type, userProfile, isStoreReady, isPeerReady, isAppReady, isConnected, hasError]);

  const handleUserSetup = async () => {
    if (userName.trim()) {
      console.log('[PAGE_DEBUG] Setting up user with name:', userName.trim());
      try {
        await initializeUser(userName.trim());
        console.log('[PAGE_DEBUG] User initialization completed');
        
        setTimeout(() => {
          console.log('[PAGE_DEBUG] Initializing peer connection...');
          initializePeerWithName(userName.trim());
        }, 100);
      } catch (error) {
        console.error('[PAGE_DEBUG] User setup failed:', error);
      }
    }
  };

  const handleMakeCall = async () => {
    if (targetPeerId.trim()) {
      const success = await makeCall(targetPeerId.trim(), 'video');
      if (!success) {
        alert('Failed to make call. Please check the peer ID and try again.');
      }
    }
  };

  const handleCopyCallId = async () => {
    if (myPeerId) {
      try {
        await navigator.clipboard.writeText(myPeerId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy Call ID:', error);
        const textArea = document.createElement('textarea');
        textArea.value = myPeerId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (!isAppReady) {
    return (
      <div className={`min-h-screen relative ${poppins.className}`}>
        <div className="absolute inset-0">
          <Squares 
            direction="right"
            speed={0.5}
            borderColor="rgba(156, 163, 175, 0.3)"
            squareSize={60}
            hoverFillColor="rgba(59, 130, 246, 0.1)"
          />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-sm sm:max-w-md w-full">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <BlurText 
              text="Setting up Nocap-Meet..." 
              className="text-gray-700 text-base sm:text-lg font-medium" 
              delay={100}
            />
            <BlurText 
              text="Because some calls deserve real privacy" 
              className={`text-sm text-gray-600 mt-2 px-4 ${rocknRollOne.className}`}
              delay={150}
            />
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`min-h-screen relative ${poppins.className}`}>
        <div className="absolute inset-0">
          <Squares 
            direction="up"
            speed={0.3}
            borderColor="rgba(239, 68, 68, 0.3)"
            squareSize={50}
            hoverFillColor="rgba(220, 38, 38, 0.1)"
          />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <Card className="max-w-sm sm:max-w-md w-full bg-white/90 backdrop-blur-sm border border-white/20">
            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
              <BlurText 
                text="Connection Error" 
                className="text-lg sm:text-xl font-bold text-red-600" 
                delay={100}
              />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-6">
              <BlurText 
                text={storeError || peerStatus.error || "An error occurred"} 
                className="text-gray-700 mb-4 text-sm sm:text-base" 
                delay={150}
              />
              <BlurText delay={200}>
                <Button onClick={() => window.location.reload()} className="w-full py-3 text-base">
                  Reload Nocap-Meet
                </Button>
              </BlurText>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative ${poppins.className}`}>
      <div className="absolute inset-0">
        <Squares 
          direction="diagonal"
          speed={0.8}
          borderColor="rgba(148, 163, 184, 0.2)"
          squareSize={80}
          hoverFillColor="rgba(59, 130, 246, 0.08)"
        />
      </div>
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto py-4 sm:py-8 w-full max-w-sm sm:max-w-md">
          
          <div className="text-center mb-8 sm:mb-12">
            <BlurText 
              text="Nocap-Meet" 
              className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-3 sm:mb-4 ${rocknRollOne.className}`}
              delay={100}
            />
            <BlurText 
              text="Because some calls deserve real privacy" 
              className={`text-base sm:text-lg text-gray-600 mb-3 sm:mb-4 px-2 ${roboto.className}`}
              delay={150}
            />
            
            <BlurText delay={200}>
              <div className="flex items-center justify-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 font-medium">Ready to connect</span>
                  </>
                ) : peerStatus.error && peerStatus.error.includes('Retrying') ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500"></div>
                    <span className="text-orange-600 font-medium text-xs">{peerStatus.error}</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4 text-yellow-500" />
                    <span className="text-yellow-600 font-medium">Connecting...</span>
                  </>
                )}
              </div>
            </BlurText>
          </div>

          <CallStatus />

          {!userProfile ? (
            <Card className="w-full bg-white/90 backdrop-blur-sm border border-white/20 shadow-xl mx-2 sm:mx-0">
              <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
                <BlurText delay={250}>
                  <h2 className="text-lg sm:text-xl font-bold flex items-center justify-center">
                    <User className="w-5 h-5 mr-2" />
                    Setup Your Profile
                  </h2>
                </BlurText>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 flex flex-col items-center px-4 sm:px-6 pb-6">
                <BlurText 
                  text="What should we call you?" 
                  className="text-gray-600 text-center font-medium text-sm sm:text-base" 
                  delay={300}
                />
                
                <BlurText delay={350} className="w-full flex justify-center">
                  <Input
                    placeholder="Enter your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUserSetup()}
                    className="text-center text-base sm:text-lg w-full bg-white/80"
                  />
                </BlurText>
                
                <BlurText delay={400} className="w-full flex justify-center">
                  <Button 
                    onClick={handleUserSetup} 
                    disabled={!userName.trim()}
                    className="w-full py-3 text-base sm:text-lg font-semibold"
                  >
                    Create Profile
                  </Button>
                </BlurText>
                
                <BlurText 
                  text="Enter your name to get started" 
                  className="text-xs text-gray-500 text-center" 
                  delay={450}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full bg-white/90 backdrop-blur-sm border border-white/20 shadow-xl mx-2 sm:mx-0">
              <CardHeader className="text-center px-4 sm:px-6 py-4 sm:py-6">
                <BlurText delay={100}>
                  <div className="text-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl sm:text-2xl mx-auto mb-3">
                      {userProfile.name.charAt(0).toUpperCase()}
                    </div>
                    <h2 className={`text-lg sm:text-xl font-semibold ${roboto.className}`}>{userProfile.name}</h2>
                    <p className="text-sm text-gray-500">Ready to make calls</p>
                  </div>
                </BlurText>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 flex flex-col items-center px-4 sm:px-6 pb-6">
                <BlurText 
                  text="Enter friend's Call ID to connect" 
                  className="text-gray-600 text-center font-medium text-sm sm:text-base" 
                  delay={150}
                />
                
                <BlurText delay={200} className="w-full flex justify-center">
                  <Input
                    placeholder="Friend's Call ID"
                    value={targetPeerId}
                    onChange={(e) => setTargetPeerId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleMakeCall()}
                    className="text-center text-sm sm:text-lg font-mono w-full bg-white/80"
                  />
                </BlurText>
                
                <BlurText delay={250} className="w-full flex justify-center">
                  <Button 
                    onClick={handleMakeCall}
                    disabled={!targetPeerId.trim() || !isConnected || peerStatus.type === 'calling_peer' || peerStatus.type === 'in_call'}
                    className="w-full py-3 text-base sm:text-lg font-semibold"
                  >
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Make Call
                  </Button>
                </BlurText>
                
                {myPeerId && (
                  <BlurText delay={300} className="w-full flex justify-center">
                    <div className="text-center p-3 sm:p-4 bg-blue-50/80 backdrop-blur-sm rounded-lg w-full border border-blue-200/50">
                      <p className="text-sm text-blue-700 mb-2 font-medium">Your Call ID:</p>
                      <div className="flex items-start justify-center gap-2 mb-3">
                        <p className={`font-mono text-sm sm:text-lg text-blue-800 break-all flex-1 ${roboto.className}`}>
                          {myPeerId}
                        </p>
                        <button
                          onClick={handleCopyCallId}
                          className={`p-1 rounded hover:bg-blue-100 transition-colors flex-shrink-0 ${copied ? 'text-green-600' : 'text-blue-600'}`}
                          title={copied ? 'Copied!' : 'Copy Call ID'}
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-blue-600">
                        Share this with friends so they can call you
                      </p>
                    </div>
                  </BlurText>
                )}
              </CardContent>
            </Card>
          )}

          <div className="hidden">
            <video id="local-video" autoPlay muted playsInline />
            <video id="remote-video" autoPlay playsInline />
          </div>
        </div>
      </div>

      <IncomingCallModal />
      <CallInterface />
      
      <ChatToggleButton />
      <ChatWindow />
    </div>
  );
}