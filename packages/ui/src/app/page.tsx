'use client';
import { useEffect, useState } from 'react';
import { useWorkerStore } from '@/stores/workerStore';

export default function Page() {
  const {
    status,
    initializeVerifierWorker,
    initializeExtractorWorker,
    initializeProofVerificationWorker,
    verifySignature,
    extractor,
    verifyProof,
  } = useWorkerStore();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const init = async () => {
      if (!isInitialized) {
        console.log('Starting worker initialization...');
        try {
          // Initialize workers sequentially to avoid race conditions
          await initializeVerifierWorker();
          await initializeExtractorWorker();
          setIsInitialized(true);
          console.log('All workers initialized successfully');
        } catch (error) {
          console.error('Failed to initialize workers:', error);
          setIsInitialized(false);
        }
      }
    };
    
    init();
  }, [initializeVerifierWorker, initializeExtractorWorker, isInitialized]);

  const handleVerify = async () => {
    try {
      setMsg('handleVerify is being executed at the moment.')
      await verifySignature();
      setMsg('handleVerify should be ended now')
    } catch (error) {
      console.error('Error in verify signature:', error);
    }
  };

  const handleExtract = async () => {
    try {
      setMsg('handleExtract is being executed at the moment')
      await extractor();
      setMsg('handleExtract should be ended now')
    } catch (error) {
      console.error('Error in extractor:', error);
    }
  };

  const handleProofVerification = async () => {
    try {
      setMsg('handleProofVerification is being executed at the moment, worker initialization is being executed')
      await initializeProofVerificationWorker();
      setMsg('Worker for proof verificaiton is executed correctly')
      setMsg('Proof is being verified now')
      await verifyProof();
      setMsg('Proof is verified correctly. YAY! 🎉🎉!!')
    } catch (error) {
      console.error('Error in proof verification:', error);
    }
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

  const isLoading = status.status === 'computing';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-900 text-white">
      <div className="w-full max-w-xl p-6 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Aadhaar Proof Process</h1>
        
        <div className="text-center">
          <p className={`font-mono ${getStatusColor(status.status)}`}>
            Status: {status.status}
          </p>
            {(status.status === 'computing' || status.status === 'computed') && (
              <p className="text-center text-gray-300 mt-2">{status.message}</p>
            )}
          {status.status === 'errored' && status.error && (
            <div className="text-center text-red-300 mt-2 text-sm">
              <p className="font-semibold">Error:</p>
              <p className="break-words">{status.error}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Workers initialized: {isInitialized ? '✓' : '✗'}
          </p>
          <p className='text-xs text-gray-400 mt-2'>
            Status Message: {msg}
          </p>
        </div>

        <div className="flex flex-col gap-4">
            <button
                onClick={handleVerify}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-medium transition-colors"
              >
                {( (status.status === 'computing' && status.message?.includes('Verifier')))
                  ? 'Computing...'
                  : 'Verify Signature'}
              </button>

              <button
                onClick={handleExtract}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-md text-white font-medium transition-colors"
              >
                {((status.status === 'computing' && status.message?.includes('Extractor')))
                  ? 'Computing...'
                  : 'Run Extractor'}
              </button>

              <button
                onClick={handleProofVerification}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white font-medium transition-colors"
              >
                {((status.status === 'computing' && status.message?.includes('verification')))
                  ? 'Verifying...'
                  : 'Run Proof Verification'}
              </button>

        </div>
        
        {!isInitialized && (
          <p className="text-center text-yellow-300 text-sm">Initializing workers...</p>
        )}
      </div>
    </main>
  );
}