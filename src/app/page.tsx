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
import DotGrid from '@/components/ui/dot-grid-background';
import { poppins, rocknRollOne, roboto } from '@/lib/fonts';
import { 
  Phone, 
  User,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function NocapMeetHomePage() {
  const [userName, setUserName] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');

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
    const initialize = async () => {
      try {
        await initializeStore();
      } catch (error) {
        console.error('Homepage: Failed to initialize store:', error);
      }
    };

    initialize();
  }, [initializeStore]);

  useEffect(() => {
    if (currentUserId) {
      console.log('Homepage: Store initialized with user ID:', currentUserId);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (userProfile?.name) {
      setUserName(userProfile.name);
    }
  }, [userProfile]);

  const isStoreReady = !storeLoading && !!currentUserId;
  const isPeerReady = peerStatus.type !== 'idle';
  const isAppReady = isStoreReady && isPeerReady;
  const hasError = storeError || peerStatus.error;

  useEffect(() => {
    console.log('Homepage: Store state -', {
      storeLoading,
      currentUserId,
      peerStatus: peerStatus.type,
      userProfile: !!userProfile,
      isStoreReady,
      isPeerReady,
      isAppReady
    });
  }, [storeLoading, currentUserId, peerStatus.type, userProfile, isStoreReady, isPeerReady, isAppReady]);

  const handleUserSetup = async () => {
    if (userName.trim()) {
      console.log('Setting up user with name:', userName.trim());
      await initializeUser(userName.trim());
      
      setTimeout(() => {
        initializePeerWithName(userName.trim());
      }, 100);
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

  if (!isAppReady) {
    return (
      <div className={`min-h-screen relative ${poppins.className}`}>
        <DotGrid 
          dotSize={12}
          gap={24}
          baseColor="#e5e7eb"
          activeColor="#3b82f6"
          proximity={120}
          className="absolute inset-0"
        />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <BlurText 
              text="Setting up Nocap-Meet..." 
              className="text-gray-700 text-lg font-medium" 
              delay={100}
            />
            <BlurText 
              text="Direct baat cheet ladle" 
              className={`text-sm text-gray-600 mt-2 ${rocknRollOne.className}`}
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
        <DotGrid 
          dotSize={12}
          gap={24}
          baseColor="#fecaca"
          activeColor="#dc2626"
          proximity={120}
          className="absolute inset-0"
        />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <Card className="max-w-md w-full mx-4 bg-white/90 backdrop-blur-sm border border-white/20">
            <CardHeader>
              <BlurText 
                text="Connection Error" 
                className="text-xl font-bold text-red-600" 
                delay={100}
              />
            </CardHeader>
            <CardContent>
              <BlurText 
                text={storeError || peerStatus.error || "An error occurred"} 
                className="text-gray-700 mb-4" 
                delay={150}
              />
              <BlurText delay={200}>
                <Button onClick={() => window.location.reload()} className="w-full">
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
      <DotGrid 
        dotSize={10}
        gap={28}
        baseColor="#e2e8f0"
        activeColor="#3b82f6"
        proximity={140}
        speedTrigger={80}
        shockRadius={200}
        shockStrength={4}
        className="absolute inset-0"
      />
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="container mx-auto px-4 py-8 max-w-md">
          
          <div className="text-center mb-12">
            <BlurText 
              text="Nocap-Meet" 
              className={`text-4xl md:text-5xl font-bold text-gray-800 mb-4 ${rocknRollOne.className}`}
              delay={100}
            />
            <BlurText 
              text="Direct baat cheet ladle" 
              className={`text-lg text-gray-600 mb-4 ${roboto.className}`}
              delay={150}
            />
            
            <BlurText delay={200}>
              <div className="flex items-center justify-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 font-medium">Ready to connect</span>
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
            <Card className="w-full bg-white/90 backdrop-blur-sm border border-white/20 shadow-xl">
              <CardHeader className="text-center">
                <BlurText delay={250}>
                  <h2 className="text-xl font-bold flex items-center justify-center">
                    <User className="w-5 h-5 mr-2" />
                    Setup Your Profile
                  </h2>
                </BlurText>
              </CardHeader>
              <CardContent className="space-y-6 flex flex-col items-center">
                <BlurText 
                  text="What should we call you?" 
                  className="text-gray-600 text-center font-medium" 
                  delay={300}
                />
                
                <BlurText delay={350} className="w-full flex justify-center">
                  <Input
                    placeholder="Enter your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUserSetup()}
                    className="text-center text-lg max-w-sm w-full bg-white/80"
                  />
                </BlurText>
                
                <BlurText delay={400} className="w-full flex justify-center">
                  <Button 
                    onClick={handleUserSetup} 
                    disabled={!userName.trim() || !isConnected}
                    className="max-w-sm w-full py-3 text-lg font-semibold"
                  >
                    {isConnected ? 'Create Profile' : 'Connecting...'}
                  </Button>
                </BlurText>
                
                {!isConnected && (
                  <BlurText 
                    text="Waiting for connection..." 
                    className="text-xs text-gray-500 text-center" 
                    delay={450}
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="w-full bg-white/90 backdrop-blur-sm border border-white/20 shadow-xl">
              <CardHeader className="text-center">
                <BlurText delay={100}>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
                      {userProfile.name.charAt(0).toUpperCase()}
                    </div>
                    <h2 className={`text-xl font-semibold ${roboto.className}`}>{userProfile.name}</h2>
                    <p className="text-sm text-gray-500">Ready to make calls</p>
                  </div>
                </BlurText>
              </CardHeader>
              <CardContent className="space-y-6 flex flex-col items-center">
                <BlurText 
                  text="Enter friend's Call ID to connect" 
                  className="text-gray-600 text-center font-medium" 
                  delay={150}
                />
                
                <BlurText delay={200} className="w-full flex justify-center">
                  <Input
                    placeholder="Friend's Call ID"
                    value={targetPeerId}
                    onChange={(e) => setTargetPeerId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleMakeCall()}
                    className="text-center text-lg font-mono max-w-sm w-full bg-white/80"
                  />
                </BlurText>
                
                <BlurText delay={250} className="w-full flex justify-center">
                  <Button 
                    onClick={handleMakeCall}
                    disabled={!targetPeerId.trim() || !isConnected || peerStatus.type === 'calling_peer' || peerStatus.type === 'in_call'}
                    className="max-w-sm w-full py-3 text-lg font-semibold"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Make Call
                  </Button>
                </BlurText>
                
                {myPeerId && (
                  <BlurText delay={300} className="w-full flex justify-center">
                    <div className="text-center p-4 bg-blue-50/80 backdrop-blur-sm rounded-lg max-w-sm w-full border border-blue-200/50">
                      <p className="text-sm text-blue-700 mb-2 font-medium">Your Call ID:</p>
                      <p className={`font-mono text-lg text-blue-800 break-all ${roboto.className}`}>
                        {myPeerId}
                      </p>
                      <p className="text-xs text-blue-600 mt-2">
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