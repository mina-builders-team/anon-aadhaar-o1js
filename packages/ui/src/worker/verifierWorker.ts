import * as Comlink from 'comlink';
import { WorkerStatus } from '@/worker_utils/utils';
import { hashProgram, AadhaarVerifier, getQRData, prepareRecursiveHashData } from 'anon-aadhaar-o1js';
import { JsonProof, VerificationKey, Cache } from 'o1js';
import { loadVK, saveProof, saveVK } from '@/worker_utils/dbHelpers';
import { TEST_DATA } from 'anon-aadhaar-o1js/build/src/getQRData';
import { fetchHashCacheFiles, fetchVerifierCacheFiles, MinaFileSystem } from '@/worker_utils/utils';


let isInitialized = false;

let verificationKey: VerificationKey = VerificationKey.empty();

function setStatus(status: WorkerStatus) {
  self.postMessage(JSON.stringify(status));
}

setStatus({ status: 'uninitialized' });

async function init() {
  try {
    setStatus({ status: 'computing', message: 'Compiling Hash Circuit' });

    const hashCacheFiles = await fetchHashCacheFiles();
    const verifierCacheFiles = await fetchVerifierCacheFiles();

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;

    setStatus({ status: 'computing', message: 'Compiling "hashProgram" Circuit' });

    await hashProgram.compile({ cache: hashCache});
    setStatus({ status: 'computed', message: 'Compiled "hashProgram" Circuit' });

    setStatus({ status: 'computing', message: 'Compiling "AadhaarVerifier" Circuit' });

    const aadhaarVK = await AadhaarVerifier.compile({ cache: verifierCache})

    const loadedVK = await loadVK('aadhaar-vk', 3)

    if(!loadedVK){
      const aadhaarVKStirng = JSON.stringify(aadhaarVK)
      await saveVK('aadhaar-vk', aadhaarVKStirng, 3)
    }
    
    setStatus({ status: 'computed', message: 'Computed "AadhaarVerifier" Circuit' });
    
    isInitialized = true;

    setStatus({ status: 'ready' });
  } catch (e) {
    setStatus({ status: 'errored', error: e instanceof Error ? e.message : 'Initialization failed' });
  }
}

async function verifySignature(): Promise<void> {
  if (!isInitialized) {
    setStatus({ status: 'errored', error: 'Worker is not initialized. Please call init() first.' });
    return;
  }
  
  try {
    setStatus({ status: 'computing', message: 'Executing Signature Verification Method' });
    const inputs = getQRData(TEST_DATA)
    const blocks = prepareRecursiveHashData(inputs.signedData)
    
    let time = performance.now()
    const {proof} = await AadhaarVerifier.verifySignature(blocks, inputs.signatureBigint, inputs.publicKeyBigint)
    const proofString = JSON.stringify(proof)
    let timeEnd = performance.now()

    setStatus({status: 'computing', message: `Executed Signature Verification in ${(timeEnd - time) / 1000 }`})

    await saveProof('signature-proof', proofString, 3);

    setStatus({ status: 'ready' });

  } catch (error: unknown) {
    if (error instanceof Error) {
      setStatus({ status: 'errored', error: error.message });
    } else {
      setStatus({ status: 'errored', error: 'Verification failed!' });
    }
  }
}

async function cleanup() {
  try {
    // Clear any large objects
    verificationKey = VerificationKey.empty();
    
    // Force garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
    
    console.log('Verifier worker cleanup completed');
  } catch (e) {
    console.log('Cleanup error (non-critical):', e);
  }
}

const api = {
  init,
  verifySignature,
  cleanup, // ✅ Expose cleanup function
};

export type SignatureWorkerAPI = typeof api;
Comlink.expose(api);