'use client';

import { WebRTCProvider } from '@/context/webrtc-context';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <WebRTCProvider>
      {children}
    </WebRTCProvider>
  );
}