'use client';

import { PeerProvider } from '@/context/peer-context';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <PeerProvider>
      {children}
    </PeerProvider>
  );
}