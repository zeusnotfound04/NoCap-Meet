import React from 'react';
import { usePeer } from '@/context/peer-context';

export const RingtoneTestButton: React.FC = () => {
  const { testRingtone, stopRingtone, status } = usePeer();

  return (
    <div className="flex gap-2 p-4 bg-gray-100 rounded-lg">
      <button 
        onClick={testRingtone}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        disabled={status.type === 'in_call'}
      >
        🔊 Test Ringtone
      </button>
      
      <button 
        onClick={stopRingtone}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
      >
        🔇 Stop Ringtone
      </button>
      
      <div className="flex items-center text-sm text-gray-600">
        Status: <span className="ml-1 font-medium">{status.type}</span>
      </div>
    </div>
  );
};

export default RingtoneTestButton;
