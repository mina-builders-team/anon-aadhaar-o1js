import * as Comlink from 'comlink';
import { AadhaarVerifier, AadharCredential, hashProgram, SignatureVerifier } from 'anon-aadhaar-o1js';
import { fetchHashCacheFiles, fetchVerifierCacheFiles, MinaFileSystem, WorkerStatus } from '@/worker_utils/utils';

let isInitialized = false;
const proofsEnabled = true;

/**
 * Updates the status in the workerStore
 */
function setStatus(status: WorkerStatus) {
  self.postMessage(JSON.stringify(status));
}
  
setStatus({ status: 'uninitialized' });

/**
 * Initialize the worker by compiling the circuits
 */
async function init() {
  try {
    setStatus({ status: 'computing', message: 'fetching cache files' });

    const hashCacheFiles = await fetchHashCacheFiles();
    const verifierCacheFiles = await fetchVerifierCacheFiles();

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;

    setStatus({ status: 'computing', message: 'Compiling "hashProgram" Circuit' });
    console.time('hashProgram Compilation')
    await hashProgram.compile({ proofsEnabled, cache: hashCache});
    console.timeEnd('hashProgram Compilation')

    setStatus({ status: 'computing', message: 'Compiling "AadhaarVerifier" Circuit' });
    console.time('AadhaarVerifier Compilation')
    const aadhaarVK = await AadhaarVerifier.compile({ proofsEnabled, cache: verifierCache})
    console.timeEnd('AadhaarVerifier Compilation')

    // const loadedVK = await loadVK('aadhaar-vk', 3)
    // if(!loadedVK){
    //   const aadhaarVKStirng = JSON.stringify(aadhaarVK)
    //   await saveVK('aadhaar-vk', aadhaarVKStirng, 3)
    // }
    
    setStatus({ status: 'computing', message: 'Compiling AadharCredential Circuit' });
    console.time('AadharCredential Compilation');
    const vk = await AadharCredential.compile();
    console.timeEnd('AadharCredential Compilation');

    isInitialized = true;
    setStatus({ status: 'ready' });
  } catch (e) {
    setStatus({ status: 'errored', error: e instanceof Error ? e.message : 'Initialization failed' });
  }
}

/**
 * Simulates the main computation workload
 */
async function verifySignature() {
  if (!isInitialized) {
    console.error('Worker is not initialized. Please call init() first.');
    setStatus({ status: 'errored', error: 'Worker is not initialized. Please call init() first.' });
    return;
  }

  try {
    setStatus({ status: 'computing', message: 'Starting proof generation 1' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStatus({ status: 'computing', message: 'Starting proof generation 2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStatus({ status: 'computing', message: 'Starting proof generation 3' });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    setStatus({ status: 'errored', error: e instanceof Error ? e.message : 'Computation failed' });
  } finally {
    setStatus({ status: 'ready' });
  }
}

const api = {
  init,
  verifySignature,
};

export type API = typeof api;

Comlink.expose(api);
