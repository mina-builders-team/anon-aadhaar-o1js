'use client';
import { useEffect } from 'react';
import { useWorkerStore } from '@/stores/workerStore';
import { loadVK,loadProof } from '@/worker_utils/dbHelpers';
import { AadhaarVerifierProof } from 'anon-aadhaar-o1js';
import { VerificationKey, verify } from 'o1js';

export default function Page() {
  const {
    status,
    initializeVerifierWorker,
    initializeExtractorWorker,
    initializeProofVerificationWorker,
    verifySignature,
    extractor,
    verifyProof,
    createCredential
  } = useWorkerStore();


  useEffect(() => {
    const init = () => {
      initializeVerifierWorker();
      initializeExtractorWorker();  
      initializeProofVerificationWorker();
    };
    init();
  }, [initializeVerifierWorker]);

  const handleVerify = async () => {
    await verifySignature();
  };

  const handleExtract = async () => {
    await extractor();
  };

  const handleProofVerification = async () => {
    await verifyProof()
  };

  const handleCreateCredential = async () => {
    await createCredential()
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-400';
      case 'errored': return 'text-red-400';
      case 'computing': return 'text-blue-400';
      default: return 'text-yellow-400';
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-900 text-white">
      <div className="w-full max-w-xl p-6 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Aadhaar Proof Process</h1>

        <p className={`text-center font-mono ${getStatusColor(status.status)}`}>
          Status: {status.status}
        </p>

        {status.status === 'errored' && (
          <p className="text-center text-red-300">Error: {status.error}</p>
        )}

        <div className="flex flex-col gap-4">
          <button
            onClick={handleVerify}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-medium"
          >
            Verify Signature
          </button>

          <button
            onClick={handleExtract}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-md text-white font-medium"
          >
            Run Extractor
          </button>
          <button 
            onClick={handleProofVerification}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-md text-white font-medium">
              Run Proof Verification
          </button>
          <button
            onClick={handleCreateCredential}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-md text-white font-medium">
            create AadhaarCredential
          </button>
        </div>
      </div>
    </main>
  );
}
