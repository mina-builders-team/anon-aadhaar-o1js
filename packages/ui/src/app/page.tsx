'use client';
import { useEffect } from 'react';
import { useWorkerStore } from '@/stores/workerStore';
import { TEST_DATA } from 'anon-aadhaar-o1js';

export default function Page() {
  const { status, isInitialized, initialize, createCredential } = useWorkerStore();
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  const handleCreateCredential = async () => {
    await createCredential(TEST_DATA);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-400';
      case 'errored': return 'text-red-400';
      case 'computing': return 'text-blue-400';
      case 'uninitialized': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-900 text-white">
      <div className="w-full max-w-xl p-6 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Aadhaar Proof Process</h1>
        
        <div className="text-center">
          <p className={`font-mono ${getStatusColor(status.status)}`}>
            {status.status}: {("message" in status) ? ` ${status.message}` : ''}
          </p>
          {status.status === 'errored' && status.error && (
            <div className="text-center text-red-300 mt-2 text-sm">
              <p className="font-semibold">Error:</p>
              <p className="break-words">{status.error}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Workers initialized: {isInitialized ? '✓' : '✗'}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleCreateCredential}
            disabled={!isInitialized || status.status === 'computing'}
            className="px-4 py-2 disabled:opacity-50 bg-orange-600 hover:bg-orange-700 disabled:hover:bg-orange-600 rounded-md text-white font-medium">
            {isInitialized ? (status.status === 'computing' ? 'Working...' : 'Create AadhaarCredential') : 'Initializing workers...'}
          </button>
        </div>
      </div>
    </main>
  );
}