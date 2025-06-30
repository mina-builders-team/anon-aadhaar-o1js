import * as Comlink from 'comlink';
import { hashProgram, SignatureVerifier } from 'anon-aadhaar-o1js';

export type WorkerStatus =
  | { status: 'ready' | 'uninitialized' }
  | { status: 'computing'; message: string }
  | { status: 'errored'; error: string }

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
    setStatus({ status: 'computing', message: 'Compiling Hash Circuit' });
    console.time('Compile Hash Circuit');
    await hashProgram.compile({ proofsEnabled });
    console.timeEnd('Compile Hash Circuit');

    setStatus({ status: 'computing', message: 'Compiling Verifier Circuit' });
    console.time('Compile Verifier Circuit');
    await SignatureVerifier.compile({ proofsEnabled });
    console.timeEnd('Compile Verifier Circuit');
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
