'use client';
import { useEffect, useState } from 'react';
import { useWorkerStore } from '@/stores/workerStore';
import { useCredentialStore } from '@/stores/credentialStore';
import { TEST_DATA } from 'anon-aadhaar-o1js';
import { PrivateKey } from 'o1js';
import SpecVerification from './SpecVerification';
import { Credential } from 'mina-attestations';

export default function Page() {
  const { status, isInitialized, initialize, createCredential, verifyAadhaarVerifierProof } = useWorkerStore();
  const credentialJson = useCredentialStore((s) => s.credentialJson);
  const setCredentialJson = useCredentialStore((s) => s.setCredentialJson);
  const [aadhaarVerifierProof, setAadhaarVerifierProof] = useState<string | undefined>();
  const [proofVerified, setProofVerified] = useState<boolean | undefined>();
  const ownerKey = PrivateKey.random();
  const owner = ownerKey.toPublicKey();

  useEffect(() => {
    initialize();
  }, []);

  const handleCreateCredential = async () => {
    if (!isInitialized) {
      await initialize();
    }
    const res = await createCredential(TEST_DATA, owner);
    if (res?.credentialJson) {
      setCredentialJson(res.credentialJson);
    }
    if (res?.aadhaarVerifierProof) setAadhaarVerifierProof(res.aadhaarVerifierProof);
  };

  const handleVerifyAadhaarProof = async () => {
    if (!aadhaarVerifierProof) return;
    const ok = await verifyAadhaarVerifierProof(aadhaarVerifierProof);
    setProofVerified(!!ok);
  };

  const handleVerifyCredential = async () => {
    if (!credentialJson) return;
    console.time('Credential validation');
    await Credential.validate(await Credential.fromJSON(credentialJson));
    console.timeEnd('Credential validation');
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

        <div className="flex gap-4 justify-center">
          <button onClick={handleCreateCredential} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50" disabled={status.status === 'computing'}>
            Create Credential
          </button>
          <button onClick={handleVerifyAadhaarProof} className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50" disabled={status.status === 'computing' || !aadhaarVerifierProof}>
            Verify aadhaarVerifierProof
          </button>
          <button onClick={handleVerifyCredential} className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50" disabled={status.status === 'computing' || !credentialJson}>
            Verify credential
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-300">
          <div>Credential: {credentialJson ? 'ready' : 'not ready'}</div>
          <div>Verifier proof: {aadhaarVerifierProof ? 'ready' : 'not ready'}</div>
        </div>

        <div className="pt-6">
          <h2 className="text-lg font-semibold mb-2">Spec Verification</h2>
          <SpecVerification credentialJson={credentialJson} ownerKey={ownerKey} />
        </div>
      </div>
    </main>
  );
}