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
import SpecSettlement from './SpecSetllement';
import type { WorkerStatus } from '@/worker_utils/utils';
import ZkAppCounterDisplay from '@/components/ZkappCounter';
import { useMinaProvider } from '@/context/MinaProviderContext';

type VerificationType = 'https' | 'zkapp';

const zkAppPublicKey = 'B62qpdk93PNPuqNQpV1cBwCcE9y542sup1o6B8hqBuec2Jewk2Yioeq';

export default function Page() {
  const [activeTab, setActiveTab] = useState<VerificationType>('zkapp');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrNumericString, setQrNumericString] = useState<string | null>(null);
  const [aadhaarName, setAadhaarName] = useState<string | null>(null);
  const [aadhaarEnv, setAadhaarEnv] = useState<'test' | 'prod'>('test');
  const [workerReady, setWorkerReady] = useState<boolean>(false);
  const { provider, walletError, connectWallet, disconnectProvider, syncMinaChain } = useMinaProvider();
  const { status, initialize, createCredential, createProof, verifyAadhaarVerifierProof, validateCredential} = useWorkerStore();
  const credentialJson = useCredentialStore((s) => s.credentialJson);
  const [credentialReady,setCredentialReady] = useState<boolean>(false);
  const setCredentialJson = useCredentialStore((s) => s.setCredentialJson);
  const [aadhaarVerifierProof, setAadhaarVerifierProof] = useState<string | undefined>();
  const ownerKey = PrivateKey.fromBase58(DEMO_PRIVATEKEY);
  const owner = ownerKey.toPublicKey();
  const [validation, setValidation] = useState<boolean>(false);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [progressActive, setProgressActive] = useState(false);
  const prevStatusRef = useRef<WorkerStatus | undefined>(undefined);

  useEffect(() => {
    (async () => {
      setSteps([
        {
          id: 'init',
          label: 'Initializing workers',
          status: 'active',
        },
      ]);
      await initialize(zkAppPublicKey);
      setSteps([
        {
          id: 'init',
          label: 'Initializing workers',
          status: 'done',
        },
      ]);
      setWorkerReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!progressActive) return;
    const newStatus = status;
    prevStatusRef.current = newStatus;
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
  }, [status, progressActive]);

  const handleOpenQrModal = () => {
    setIsQrModalOpen(true);
  };
  
  const handleQrScan = (scannedQrString: string) => {
    setQrNumericString(scannedQrString);
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
    setProgressActive(true);
    if(!workerReady){
      await initialize(zkAppPublicKey);
      setSteps([
        {
          id: 'init',
          label: 'Initializing workers',
          status: 'done',
        },
      ]);        
    }
    
    const selectedKey = aadhaarEnv === 'test' ? AADHAAR_TEST_PUBLIC_KEY : AADHAAR_PROD_PUBLIC_KEY;
    
    const res = aadhaarVerifierProof
      ? await createCredential(qrData, owner, selectedKey, zkAppPublicKey, aadhaarVerifierProof)
      : await createCredential(qrData, owner, selectedKey, zkAppPublicKey);
          
    if (res?.credentialJson) {
      setCredentialJson(res.credentialJson);
      setCredentialReady(true);
    }
    if (res?.aadhaarVerifierProof) setAadhaarVerifierProof(res.aadhaarVerifierProof);
    
    setProgressActive(false);
  };

  const handleCreateProof = async (qrData: string) => {
    if(aadhaarVerifierProof){
      console.log('a proof json already exists!')
      return;
    }

    console.log('Creating proof...');
    setProgressActive(true);
    if(!workerReady){
      await initialize(zkAppPublicKey);
      setSteps([
        {
          id: 'init',
          label: 'Initializing workers',
          status: 'done',
        },
      ]);
    }
    

    const selectedKey = aadhaarEnv === 'test' ? AADHAAR_TEST_PUBLIC_KEY : AADHAAR_PROD_PUBLIC_KEY;
    const proofJson = await createProof(qrData, selectedKey, zkAppPublicKey);
    if (proofJson) setAadhaarVerifierProof(proofJson);
    
    setProgressActive(false);
  };  

  const handleVerifyCredential = async () => {
    if (!credentialJson) return;
    console.time('Credential validation');
    await validateCredential(credentialJson);
    console.timeEnd('Credential validation');
  };

  return (
    <div className="bg-gray-900 min-h-screen">
    <main className=" p-10 text-white " style={{ zoom: 0.70 } }>

      <div className='flex justify-between mb-6'> 

        <div className='flex' >
          <a 
            href="https://github.com/mina-builders-team/anon-aadhaar-o1js" 
            target="_blank" 
            rel="noopener noreferrer"
            className='py-2 px-4 flex items-center gap-2 '
          >
            <svg 
              className="w-5 h-5" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
          

           <a 
            href="https://x.com/minabuilders" 
            target="_blank" 
            rel="noopener noreferrer"
            className='py-2 px-4 flex items-center gap-2 '
          >
            <svg 
              className="w-5 h-5" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
        
        {!provider ? (
          <button
            onClick={connectWallet}
            className="px-4 py-2 bg-green-600 rounded hover:bg-green-500"
          >
            Connect Auro Wallet
          </button>
        ) : walletError ?
          (<button
            onClick={syncMinaChain}
            className="px-4 py-2 bg-orange-600 rounded hover:bg-orange-500"
          >
            Change Network
          </button>
        )
            :(
          <button
            onClick={disconnectProvider}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-500"
          >
            Disconnect Wallet
          </button>
        )}
      </div>

      <div className="flex gap-6 max-w-7xl mx-auto">
        {/* Information Cards - Left Side */}
        <div className="hidden lg:flex flex-col gap-8 w-80 flex-shrink-0 ">
          <div className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-green-400 mb-2">What is Anon Aadhaar?</h3>
            <p className="text-sm text-gray-300">
              Anon Aadhaar allows you to prove facts about your Aadhaar identity without revealing the actual document. Using zero-knowledge proofs, you maintain complete privacy.
            </p>
          </div>

          <div className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Privacy First</h3>
            <p className="text-sm text-gray-300">
              All processing happens in your browser. Your Aadhaar data <b>never</b> leaves your device, ensuring maximum privacy and security. Only the transaction data is interacted with outter world.
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="flex-1 max-w-xl p-6 space-y-6 bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-center">Anon Aadhaar</h1>
          <p className="text-sm text-gray-400 text-center mt-1">Prove facts about your Aadhaar without revealing it.</p>
          <div className='flex p-3 mt-3 bg-yellow-900/30 rounded border border-yellow-600/50 gap-3'>
            
            <svg 
              className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" 
                clipRule="evenodd" 
              />
            </svg>            
            <p className="text-sm text-yellow-200">
              <strong className="font-semibold">Warning:</strong> This project has not been audited. Although it runs entirely on the client side, we strongly recommend that you do <strong> NOT </strong> use your real Aadhaar.
            </p>
          </div>
          
          <div className="space-y-6 mt-4">
            {/* Step 1 */}
            <div className="p-4 justify-center rounded-lg bg-gray-800/60 border border-gray-700">
              <h2 className="text-lg font-semibold">Step 1 — Scan or upload your {aadhaarEnv === 'test' ? 'Test ' : ''}Aadhaar QR</h2>
              <p className="text-sm text-gray-400 mt-1">We only parse the QR locally in your browser.</p>
              <div className="mt-2 text-sm">
                {aadhaarEnv === 'test' ? (
                  <p className="text-gray-300">
                    Generate a test QR code using {' '}
                    <a
                      href="https://documentation.anon-aadhaar.pse.dev/docs/generate-qr"
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-400 hover:underline"
                    >
                      this link
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
              <div className="mt-3 p-4 flex justify-center gap-3 flex-wrap">
                <button 
                  onClick={handleOpenQrModal}
                  className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50"
                >
                  Scan or Upload
                </button>
              </div>
              <div className="mt-2 flex justify-center text-sm text-gray-300">
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
              <h2 className="text-lg font-semibold">Step 2 — Create credential or proof</h2>
              <p className="text-sm text-gray-400 mt-1">Creates a zero-knowledge credential in the browser that can be verified in browser. To settle the proof and increment counter, click create proof.</p>
              <div className="mt-3 items-center flex gap-3">
                <button
                  onClick={() => qrNumericString && handleCreateCredential(qrNumericString)}
                  className="px-4 py-2 bg-blue-600 flex-1 rounded hover:bg-blue-500 disabled:opacity-50 min-h-[44px]"
                  disabled={!qrNumericString || progressActive || !workerReady}
                >
                  {credentialReady ? "Credential Ready ✓" : "Create Credential"}
                </button>
                
                <button
                  onClick={() => qrNumericString && handleCreateProof(qrNumericString)}
                  className="px-4 py-2 bg-blue-600 flex-1 rounded hover:bg-blue-500 disabled:opacity-50 min-h-[44px]"
                  disabled={!qrNumericString || progressActive || !workerReady} 
                >
                  Create Proof
                </button>
              </div>
              <div className="mt-4">
                <ProgressSteps title="Progress" steps={steps} />
              </div>
              {status.status === 'errored' && status.error && (
                <div className="text-left text-red-300 mt-3 text-sm">
                  <p className="font-semibold">Error:</p>
                  <p className="break-words">{status.error}</p>
                </div>
              )}
            </div>
          </div>
          <div className='border border-gray-700 p-4 rounded-lg'>
          <h2 className="text-lg font-semibold mt-6">Step 3 — Test your credential</h2>
          <p className="text-sm text-gray-400 mt-1"> Validate if your credential is created correctly or not. </p>
          <div className="mt-3 gap-2 flex">
            <button 
              onClick={handleVerifyCredential} 
              className="px-4 py-2 bg-purple-600 flex-1 rounded hover:bg-purple-500 disabled:opacity-50" 
              disabled={status.status === 'computing' || !credentialReady }
            >
              Validate Credential
            </button>
          </div>
            
          <div className=" mt-6">
              <p className="text-sm text-gray-400 mt-1"> To verify credential in the browser, use <b>Browser Vericiation</b> section. To settle your proof in zkApp and increment the counter, use <b>zkApp   Verification</b> section. <br></br> Upon included tx, fetch the latest value to see your increment! </p>
            </div>
            </div>

              <nav className="-mb-px flex space-x-1" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('https')}
                  className={`px-8 py-3 text-sm flex-1 font-medium rounded-t-lg border-b-2 transition-colors relative ${activeTab === 'https' 
                    ? 'text-green-400 bg-gray-800/50 border-green-500 hover:bg-gray-800 after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-green-500/20 after:blur-sm' 
                    : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-700'}`}
                >
                  Browser Verification
                </button>
                <button
                  onClick={() => setActiveTab('zkapp')}
                  className={`px-8 py-3 text-sm flex-1 font-medium rounded-t-lg border-b-2 transition-colors relative ${activeTab === 'zkapp' 
                    ? 'text-green-400 bg-gray-800/50 border-green-500 hover:bg-gray-800 after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-green-500/20 after:blur-sm' 
                    : 'text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-700'}`}
                >
                  zkApp Verification
                </button>
              </nav>
            <div className="pt-8">
              {activeTab === 'https' ? (
                <SpecVerification credentialJson={credentialJson} ownerKey={ownerKey} aadhaarEnv={aadhaarEnv} disabled={progressActive}/>
              ) : activeTab === 'zkapp' ? (
                <SpecSettlement proofJson={aadhaarVerifierProof as string} zkAppPublicKey={zkAppPublicKey} />
              ) : (
                <div className="text-gray-400 text-center py-8">
                  ...
                </div>
              )}
            </div>
            <div className="pt-8">
              <ZkAppCounterDisplay zkAppPublicKey={zkAppPublicKey} ></ZkAppCounterDisplay>
            </div>
        </div>

        <div className="flex gap-6 max-w-7xl mx-auto">
        {/* Information Cards - Left Side */}
        <div className="hidden lg:flex flex-col py-60 gap-28 w-80 flex-shrink-0 ">
          <div className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-green-400 mb-2">Step 1</h3>
            <p className="text-sm text-gray-300">
              Click to the QR code generation link. After downloading, upload it using <em>Scan or Upload</em> button.
            </p>
          </div>
          
          <div className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-green-400 mb-2">Step 2</h3>
            <ul className="text-sm text-gray-300 space-y-2">
              Wait for workers to be initialized. When initialized you can choose: 
              <li>• <strong>Create Credential</strong> button, to create credential and verify it using <strong>Browser Verification</strong> section. </li>
              <li>• <strong> Create Proof</strong> button, to create a zk proof and verify it using <strong>zkApp Verification</strong> section, which will require your signature and increase the counter below! </li>
            </ul>
          </div>

          <div className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-green-400 mb-2">Step 3</h3>
            <p className="text-sm text-gray-300">
              If you chose to create a credential, you can validate it here to check if it is created correctly. 
            </p>
          </div>
          
          <div className="p-4 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <h3 className="text-lg font-semibold text-green-400 mb-2">Step 4</h3>
            <p className="text-sm text-gray-300">
              After you created your proof, you can settle it. When you send the settlement tx, you will be able to see your tx link. When tx is included, click <strong>refresh</strong> to see the increment.
            </p>
          </div>
        </div>
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
    </div>
  );
}