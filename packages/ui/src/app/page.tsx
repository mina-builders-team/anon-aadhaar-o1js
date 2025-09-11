'use client';
import { useEffect, useRef, useState } from 'react';
import { useWorkerStore } from '@/stores/workerStore';
import { useCredentialStore } from '@/stores/credentialStore';
import { DEMO_PRIVATEKEY, DELIMITER_POSITION, getQRData, AADHAAR_TEST_PUBLIC_KEY, AADHAAR_PROD_PUBLIC_KEY } from 'anon-aadhaar-o1js';
import { PrivateKey } from 'o1js';
import SpecVerification from './SpecVerification';
import { Credential } from 'mina-attestations';
import { QrScannerModal } from '@/components/QrScannerModal';
import { ProgressSteps, type StepItem } from '@/components/ProgressSteps';
import type { WorkerStatus } from '@/worker_utils/utils';

type VerificationType = 'https' | 'zkapp';

export default function Page() {
  const [activeTab, setActiveTab] = useState<VerificationType>('https');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrNumericString, setQrNumericString] = useState<string | null>(null);
  const [aadhaarName, setAadhaarName] = useState<string | null>(null);
  const [aadhaarEnv, setAadhaarEnv] = useState<'test' | 'prod'>('test');

  const { status, isInitialized, initialize, createCredential, verifyAadhaarVerifierProof } = useWorkerStore();
  const credentialJson = useCredentialStore((s) => s.credentialJson);
  const setCredentialJson = useCredentialStore((s) => s.setCredentialJson);
  const [aadhaarVerifierProof, setAadhaarVerifierProof] = useState<string | undefined>();
  const ownerKey = PrivateKey.fromBase58(DEMO_PRIVATEKEY);
  const owner = ownerKey.toPublicKey();
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [progressActive, setProgressActive] = useState(false);
  const prevStatusRef = useRef<WorkerStatus | undefined>(undefined);

  useEffect(() => {
    initialize();
  }, []);

  // Reflect worker status as steps only when progress is active (after user clicks Create)
  useEffect(() => {
    if (!progressActive) return;
    const newStatus = status;
    const prev = prevStatusRef.current;
    setSteps((prevSteps) => {
      const updated = [...prevSteps];
      const markLastActive = (state: 'done' | 'error', labelOverride?: string) => {
        const last = updated.at(-1);
        if (last && last.status === 'active') {
          updated[updated.length - 1] = {
            ...last,
            status: state === 'done' ? 'done' : 'error',
            label: labelOverride ?? last.label,
          };
        }
      };

      if (newStatus.status === 'computing') {
        markLastActive('done');
        updated.push({
          id: `worker-${updated.length + 1}`,
          label: newStatus.message,
          status: 'active',
        });
      } else if (newStatus.status === 'computed') {
        markLastActive('done', newStatus.message);
      } else if (newStatus.status === 'errored') {
        markLastActive('error');
      }
      return updated;
    });
    prevStatusRef.current = newStatus;
  }, [status]);

  const handleOpenQrModal = () => {
    setIsQrModalOpen(true);
  };
  const handleQrScan = (scannedQrString: string) => {
    setQrNumericString(scannedQrString);
    // Extract name for Step 1 display
    try {
      const selectedKey = aadhaarEnv === 'test' ? AADHAAR_TEST_PUBLIC_KEY : AADHAAR_PROD_PUBLIC_KEY;
      const qrData = getQRData(scannedQrString, selectedKey);
      const signedData = qrData.signedData;
      const delimiterPositions: number[] = [];
      for (let i = 0; i < signedData.length; i++) {
        if (signedData[i] === 0xFF) delimiterPositions.push(i);
      }
      const name = new TextDecoder().decode(
        signedData.subarray(
          delimiterPositions[DELIMITER_POSITION.NAME - 1] + 1,
          delimiterPositions[DELIMITER_POSITION.NAME]
        )
      );
      setAadhaarName(name || null);
    } catch (e) {
      console.error('Failed to extract Aadhaar name from QR:', e);
      setAadhaarName(null);
    }
  };

  const handleCreateCredential = async (qrData: string) => {
    console.log('Creating credential...');
    // Reset steps and seed with scan step
    setProgressActive(true);
    await initialize();
    setSteps([
      {
        id: 'init',
        label: 'Initializing workers',
        status: 'done',
      },
    ]);

    const selectedKey = aadhaarEnv === 'test' ? AADHAAR_TEST_PUBLIC_KEY : AADHAAR_PROD_PUBLIC_KEY;
    const res = await createCredential(qrData, owner, selectedKey);
    if (res?.credentialJson) {
      setCredentialJson(res.credentialJson);
    }
    if (res?.aadhaarVerifierProof) setAadhaarVerifierProof(res.aadhaarVerifierProof);
    
    setProgressActive(false);
  };

  const handleVerifyAadhaarProof = async () => {
    if (!aadhaarVerifierProof) return;
    const ok = await verifyAadhaarVerifierProof(aadhaarVerifierProof);
    console.log('Aadhaar proof verified:', ok);
  };

  const handleVerifyCredential = async () => {
    if (!credentialJson) return;
    console.time('Credential validation');
    await Credential.validate(await Credential.fromJSON(credentialJson));
    console.timeEnd('Credential validation');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-900 text-white">
      <div className="w-full max-w-xl p-6 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Anon Aadhaar</h1>
        <p className="text-sm text-gray-400 text-center mt-1">Prove facts about your Aadhaar without revealing it.</p>
        {/* Mode toggle */}
        <div className="mt-2 flex justify-center items-center gap-2">
          <span className="text-xs text-gray-400">Mode:</span>
          <div className="inline-flex rounded overflow-hidden border border-gray-700">
            <button
              onClick={() => setAadhaarEnv('test')}
              className={`px-3 py-1 text-xs ${aadhaarEnv === 'test' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Test
            </button>
            <button
              onClick={() => setAadhaarEnv('prod')}
              className={`px-3 py-1 text-xs ${aadhaarEnv === 'prod' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Prod
            </button>
          </div>
        </div>
        {/* Status indicators moved to Step 2 */}
        
        <div className="space-y-6 mt-4">
          {/* Step 1 */}
          <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700">
            <h2 className="text-lg font-semibold">Step 1 — Scan or upload your {aadhaarEnv === 'test' ? 'Test ' : ''}Aadhaar QR</h2>
            <p className="text-sm text-gray-400 mt-1">We only parse the QR locally in your browser.</p>
            {/* Where to get a QR based on mode */}
            <div className="mt-2 text-sm">
              {aadhaarEnv === 'test' ? (
                <p className="text-gray-300">
                  Don't have a test QR?{' '}
                  <a
                    href="https://documentation.anon-aadhaar.pse.dev/docs/generate-qr"
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-400 hover:underline"
                  >
                    Generate one here
                  </a>
                  .
                </p>
              ) : (
                <p className="text-gray-300">
                  Get your official QR from the mAadhaar app (My Aadhaar → Generate QR Code → Share and Save the QR image).{' '}
                  <a
                    href="https://play.google.com/store/apps/details?id=in.gov.uidai.mAadhaarPlus"
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-400 hover:underline"
                  >
                    Install/open mAadhaar
                  </a>
                  .
                </p>
              )}
            </div>
            <div className="mt-3 flex gap-3 flex-wrap">
              <button 
                onClick={handleOpenQrModal}
                className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50"
              >
                Scan or Upload
              </button>
            </div>
            <div className="mt-2 text-sm text-gray-300">
              {qrNumericString && aadhaarName ? (
                <>
                  <span className="font-medium text-gray-400  ">Aadhaar Name:</span> <span className="text-white">{aadhaarName}</span>
                </>
              ) : (
                'Not scanned'
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700">
            <h2 className="text-lg font-semibold">Step 2 — Create credential</h2>
            <p className="text-sm text-gray-400 mt-1">Generates a zero-knowledge credential in the browser.</p>
            <div className="mt-3 items-center gap-3">
              <button 
                onClick={() => qrNumericString && handleCreateCredential(qrNumericString)}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
                disabled={!qrNumericString || progressActive}
              >
                Create Credential
              </button>
              {credentialJson && (
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-sm">Credential ready</span>
                </div>
              )}
            </div>
            {/* Progress list for this flow */}
            {progressActive && (
              <div className="mt-4">
                <ProgressSteps title="Progress" steps={steps} />
              </div>
            )}
            {status.status === 'errored' && status.error && (
              <div className="text-left text-red-300 mt-3 text-sm">
                <p className="font-semibold">Error:</p>
                <p className="break-words">{status.error}</p>
              </div>
            )}
          </div>
        </div>

        <h2 className="text-lg font-semibold mt-6">Step 3 — Test your credential</h2>
        <div className="mt-3 gap-2 flex">
          <button 
            onClick={handleVerifyCredential} 
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50" 
            disabled={status.status === 'computing' || !credentialJson}
          >
            Verify Credential
          </button>
          <button 
            onClick={handleVerifyAadhaarProof} 
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500 disabled:opacity-50" 
            disabled={status.status === 'computing' || !aadhaarVerifierProof}
          >
            Verify Aadhaar Proof
          </button>
        </div>

        <div className="border-b border-gray-700 mt-6">
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
              <SpecVerification credentialJson={credentialJson} ownerKey={ownerKey} aadhaarEnv={aadhaarEnv} disabled={progressActive}/>
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
        publicKeyHex={aadhaarEnv === 'test' ? AADHAAR_TEST_PUBLIC_KEY : AADHAAR_PROD_PUBLIC_KEY}
        aadhaarMode={aadhaarEnv}
      />
    </main>
  );
}