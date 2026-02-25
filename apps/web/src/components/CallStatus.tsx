'use client';

import { usePeer } from '@/context/peer-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  PhoneOff, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Clock
} from 'lucide-react';

export function CallStatus() {
  const { status, endCall, incomingCall } = usePeer();

  if (status.type === 'connected' || status.type === 'idle' || status.type === 'incoming_call' || status.type === 'in_call') {
    return null;
  }

  const getStatusInfo = () => {
    switch (status.type) {
      case 'connecting':
        return {
          icon: <Loader2 className="w-5 h-5 animate-spin text-blue-500" />,
          title: 'Connecting...',
          description: 'Setting up your connection',
          color: 'bg-blue-50 border-blue-200'
        };
        
      case 'permission':
        return {
          icon: <Clock className="w-5 h-5 text-yellow-500" />,
          title: 'Camera & Microphone Access',
          description: 'Please allow camera and microphone permissions in your browser',
          color: 'bg-yellow-50 border-yellow-200'
        };
        
      case 'calling_peer':
        return {
          icon: <Phone className="w-5 h-5 text-blue-500" />,
          title: 'Calling...',
          description: incomingCall ? `Calling ${incomingCall.metadata?.callerName || 'Unknown'}...` : 'Connecting to peer...',
          color: 'bg-blue-50 border-blue-200',
          showEndCall: true
        };
        
      case 'call_ended':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
          title: 'Call Ended',
          description: 'The call has been ended',
          color: 'bg-green-50 border-green-200'
        };
        
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-500" />,
          title: 'Connection Error',
          description: status.error || 'Something went wrong',
          color: 'bg-red-50 border-red-200'
        };
        
      default:
        return null;
    }
  };

  const statusInfo = getStatusInfo();
  
  if (!statusInfo) {
    return null;
  }

  return (
    <Card className={`mb-6 ${statusInfo.color}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {statusInfo.icon}
            <div>
              <h3 className="font-medium text-gray-800">
                {statusInfo.title}
              </h3>
              <p className="text-sm text-gray-600">
                {statusInfo.description}
              </p>
              
              {/* Additional info for specific states */}
              {status.type === 'permission' && (
                <div className="mt-2 text-xs text-gray-500">
                  <p>1. Click "Allow" when prompted</p>
                  <p>2. If blocked, click the camera icon in your address bar</p>
                </div>
              )}
              
              {status.type === 'error' && (
                <div className="mt-2">
                  <Button 
                    size="sm" 
                    onClick={() => window.location.reload()}
                    className="text-xs"
                  >
                    Reload Page
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {statusInfo.showEndCall && (
            <Button
              variant="destructive"
              size="sm"
              onClick={endCall}
              className="rounded-full"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}