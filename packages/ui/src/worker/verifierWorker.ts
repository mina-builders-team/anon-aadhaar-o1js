import * as Comlink from 'comlink';
import { WorkerStatus } from '@/worker_utils/utils';
import { hashProgram, AadhaarVerifier, getQRData, prepareRecursiveHashData } from 'anon-aadhaar-o1js';
import { VerificationKey, Cache } from 'o1js';
import { TEST_DATA } from 'anon-aadhaar-o1js/build/src/getQRData';
import { fetchHashCacheFiles, fetchVerifierCacheFiles, MinaFileSystem } from '@/worker_utils/utils';

let isInitialized = false;

let verificationKey: VerificationKey = VerificationKey.empty();


async function init() {
  try {
    console.log('Compiling Hash Circuit')
    const hashCacheFiles = await fetchHashCacheFiles();
    const verifierCacheFiles = await fetchVerifierCacheFiles();

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;

    console.log('Compiling "hashProgram" Circuit')

    await hashProgram.compile({ cache: hashCache});

    console.log('Compiling "AadhaarVerifier" Circuit')

    const aadhaarVK = await AadhaarVerifier.compile({ cache: verifierCache})

    console.log('Computed "AadhaarVerifier" Circuit')
    
    isInitialized = true;
    
    console.log('ready')

    const aadhaarVKString = JSON.stringify(aadhaarVK.verificationKey)
  
    return aadhaarVKString

  } catch (e) {
    console.error('Error occured: ', e)
  }
}

async function verifySignature(): Promise<string | null> {
  if (!isInitialized) {
    console.error('Worker is not initialized. Please call init() first')
    return null;
  }
  
  try {
    console.log('Executing Signature Verification Method')

    const inputs = getQRData(TEST_DATA)
    const blocks = prepareRecursiveHashData(inputs.signedData)

    const { proof } = await AadhaarVerifier.verifySignature(blocks, inputs.signatureBigint, inputs.publicKeyBigint)
    const proofString = JSON.stringify(proof.toJSON())

    console.log('Executed Signature Verification ')

    return proofString

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(error.message)
      return null
    } else {
      console.log('Verification failed!' ) 
      return null
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