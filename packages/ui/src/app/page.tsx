'use client';
import { useEffect, useState } from 'react';
import { useWorkerStore } from '@/stores/workerStore';
import { useCredentialStore } from '@/stores/credentialStore';
import { DEMO_PRIVATEKEY, TEST_DATA } from 'anon-aadhaar-o1js';
import { PrivateKey } from 'o1js';
import SpecVerification from './SpecVerification';
import { Credential } from 'mina-attestations';
import { QrScannerModal } from '@/components/QrScannerModal';

type VerificationType = 'https' | 'zkapp';
type VerificationStep = 'aadhaar' | 'credential' | null;

export default function Page() {
  const [activeTab, setActiveTab] = useState<VerificationType>('https');
  const [activeVerificationStep, setActiveVerificationStep] = useState<VerificationStep>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrNumericString, setQrNumericString] = useState<string | null>(null);

  const { status, isInitialized, initialize, createCredential, verifyAadhaarVerifierProof } = useWorkerStore();
  const credentialJson = useCredentialStore((s) => s.credentialJson);
  const setCredentialJson = useCredentialStore((s) => s.setCredentialJson);
  const [aadhaarVerifierProof, setAadhaarVerifierProof] = useState<string | undefined>();
  const [proofVerified, setProofVerified] = useState<boolean | undefined>();
  const ownerKey = PrivateKey.fromBase58(DEMO_PRIVATEKEY);
  const owner = ownerKey.toPublicKey();

  useEffect(() => {
    initialize();
  }, []);

  const handleOpenQrModal = () => {
    setIsQrModalOpen(true);
  };

  const handleQrScan = (scannedQrString: string) => {
    setQrNumericString(scannedQrString);
    handleCreateCredential(scannedQrString);
  };

  const handleCreateCredential = async (qrData: string = TEST_DATA) => {
    if (!isInitialized) {
      await initialize();
    }
    
    const res = await createCredential(qrData, owner);
    if (res?.credentialJson) {
      setCredentialJson(res.credentialJson);
    }
    if (res?.aadhaarVerifierProof) setAadhaarVerifierProof(res.aadhaarVerifierProof);
    
    // Reset QR data after successful credential creation
    setQrNumericString(null);
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
        <h1 className="text-2xl font-bold text-center">Anon Aadhaar</h1>
        
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

        <div className="flex gap-4 justify-center flex-wrap">
          <button 
            onClick={handleOpenQrModal} 
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50" 
            disabled={false}
          >
            Create Credential
          </button>
          <button 
            onClick={handleVerifyAadhaarProof} 
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50" 
            disabled={status.status === 'computing' || !aadhaarVerifierProof}
          >
            Verify aadhaarVerifierProof
          </button>
          <button 
            onClick={handleVerifyCredential} 
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50" 
            disabled={status.status === 'computing' || !credentialJson}
          >
            Verify credential
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-300">
          <div>QR Data: {qrNumericString ? 'scanned' : 'not scanned'}</div>
          <div>Credential: {credentialJson ? 'ready' : 'not ready'}</div>
          <div>Verifier proof: {aadhaarVerifierProof ? 'ready' : 'not ready'}</div>
        </div>

        <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-1" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('https')}
                className={`px-8 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors relative ${activeTab === 'https' 
                  ? 'text-green-400 bg-gray-800/50 border-green-500 hover:bg-gray-800 after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-green-500/20 after:blur-sm' 
                  : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-700'}`}
              >
                HTTPS Verification
              </button>
              <button
                onClick={() => setActiveTab('zkapp')}
                className={`px-8 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors relative ${activeTab === 'zkapp' 
                  ? 'text-green-400 bg-gray-800/50 border-green-500 hover:bg-gray-800 after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-green-500/20 after:blur-sm' 
                  : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-700'}`}
              >
                zkApp Verification
              </button>
            </nav>
          </div>
          <div className="pt-8">
            {activeTab === 'https' ? (
              <SpecVerification credentialJson={credentialJson} ownerKey={ownerKey} />
            ) : (
              <div className="text-gray-400 text-center py-8">
                ...
              </div>
            )}
          </div>
      </div>
      
      {/* QR Scanner Modal */}
      <QrScannerModal 
        isOpen={isQrModalOpen} 
        onClose={() => setIsQrModalOpen(false)} 
        onScan={handleQrScan} 
      />
    </main>
  );
}