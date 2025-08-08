import { create } from 'zustand';
import { WorkerStatus } from '@/worker_utils/utils';
import * as Comlink from 'comlink';
import type { SignatureWorkerAPI } from '../worker/verifierWorker';
import type { ExtractorWorkerAPI } from '../worker/extractorWorker';
import type { ProofVerificationWorkerAPI } from '@/worker/proofVerificationWorker';
import type { API } from '../worker/worker';

let verifierWorker: Worker | null = null;
let verifierProxy: Comlink.Remote<SignatureWorkerAPI> | null = null;
let extractorWorker: Worker | null = null;
let extractorProxy: Comlink.Remote<ExtractorWorkerAPI> | null = null;
let proofVerificationWorker: Worker | null = null;
let proofVerificationProxy: Comlink.Remote<ProofVerificationWorkerAPI> | null = null;
let worker: Worker | null = null;
let proxy: Comlink.Remote<API> | null = null;

const terminateVerifierWorker = () => {
  if (verifierWorker) {
    verifierWorker.terminate();
    verifierWorker = null;
    verifierProxy = null;
  }
};

const terminateExtractorWorker = () => {
  if (extractorWorker) {
    extractorWorker.terminate();
    extractorWorker = null;
    extractorProxy = null;
  }
};

const initWorker = () => {
  if (typeof window !== 'undefined' && !worker) {
    worker = new Worker(new URL('../worker/worker.ts', import.meta.url));
    proxy = Comlink.wrap<API>(worker);
  }
};

function initVerifierWorker() {
  if (typeof window !== 'undefined' && !verifierWorker){
    verifierWorker = new Worker(new URL('../worker/verifierWorker.ts', import.meta.url))
    verifierProxy = Comlink.wrap<SignatureWorkerAPI>(verifierWorker)
  }
}

function initExtractorWorker() {
  if (typeof window !== 'undefined' && !extractorWorker) {
    extractorWorker = new Worker(new URL('../worker/extractorWorker.ts', import.meta.url));
    extractorProxy = Comlink.wrap<ExtractorWorkerAPI>(extractorWorker);
  }
}

function initProofVerificationWorker(){
  if(typeof window !== 'undefined' && !proofVerificationWorker){
    proofVerificationWorker = new Worker(new URL('../worker/proofVerificationWorker.ts', import.meta.url));
    proofVerificationProxy = Comlink.wrap<ProofVerificationWorkerAPI>(proofVerificationWorker);

  }
}

interface WorkerState {
  status: WorkerStatus;
  createCredential: () => void;
  initializeVerifierWorker: () => void;
  initializeExtractorWorker: () => void;
  initializeProofVerificationWorker: () => void;
  
  verifierProxy: Comlink.Remote<SignatureWorkerAPI> | null;
  extractorProxy: Comlink.Remote<ExtractorWorkerAPI> | null;
  verifySignature: () => Promise<void>;
  extractor: () => Promise<void>;
  verifyProof: () => Promise<void>;
  cleanupWorkers: () => void;
}

export const useWorkerStore = create<WorkerState>((set, get) => ({
  status: { status: 'uninitialized' },
  verifierProxy: null,
  extractorProxy: null,

  createCredential: () => {
    initWorker();
    if (!worker || !proxy) {
      return;
    }
    proxy.init();
    worker.onmessage = (event) => {
      try {
        const status = JSON.parse(event.data);
        if (Object.keys(status).includes('status')) {
          console.log(status);
          set({ status: status });
        }
      } catch {
        // do nothing
      }
    };
  },
  
  initializeVerifierWorker: async () => {
    initVerifierWorker();
    if (!verifierWorker || !verifierProxy) return;

    set({ verifierProxy });
    
    await verifierProxy.init();
    verifierWorker.onmessage = (event) => {
      try {
        const status = JSON.parse(event.data);
        if ('status' in status) {
          console.log('[VerifierWorker status]', status);
          set({ status });
        }
      } catch {

      }
    };
  },
  
  initializeExtractorWorker: async () => {
    initExtractorWorker();
    if (!extractorWorker || !extractorProxy) return;
    
    set({ extractorProxy });
    
    await extractorProxy.init();

    extractorWorker.onmessage = (event) => {
      try {
        const status = JSON.parse(event.data);
        if ('status' in status) {
          console.log('[ExtractorWorker status]', status);
          set({ status });
        }
      } catch {
        // Do nothing
      }
    };
  },

  initializeProofVerificationWorker: async () => {
    initProofVerificationWorker()
  },
    

  verifySignature: async () => {
    const { verifierProxy } = get();
    if (!verifierProxy) {
      console.error('Verifier worker not initialized');
      return;
    }
    try {
      await verifierProxy.verifySignature();
      set({ status: {status:'computing', message: 'Computing Verifier'} });
      console.log('Are we here?')
      console.log('Terminating verifier worker to free WASM memory');
      terminateVerifierWorker();
      
    } catch (e) {
      console.error('Error verifying signature', e);

      terminateVerifierWorker();
      set({ status: { status: 'errored', error: e instanceof Error ? e.message : 'Unknown error at verification' } });
    }
  },

  cleanupWorkers: () => {
    terminateVerifierWorker();
    terminateExtractorWorker();
  },

  
  extractor: async () => {
    let { extractorProxy } = get();

    if (!extractorWorker || !extractorProxy) {
      console.log('Re-initializing extractor worker');
      get().initializeExtractorWorker();
    }
    
    set({ status: {status:'computing', message: 'Computing Extractor'}});
    const updatedState = get();
    extractorProxy = updatedState.extractorProxy;

    if (!extractorProxy) {
      console.error('Extractor worker is not initialized');
      return;
    }
    
    try {
      await extractorProxy.extract();
      
      console.log('Terminating extractor worker to free WASM memory');
      terminateExtractorWorker();
      
    } catch (e) {
      console.error('Error in extraction', e);
      terminateExtractorWorker();
      set({ status: { status: 'errored', error: e instanceof Error ? e.message : 'Unknown error at extraction' } });
    }
  },

  verifyProof: async () => {
    if(!proofVerificationWorker || !proofVerificationProxy){
      console.error('Proof verification worker is not initialized')
      return
    }
    set({status: {status:'computing', message: 'Proof verification is being executed'}})

    try{
      const res = await proofVerificationProxy.verifyProof()
      console.log(res)
    } catch(e){
      console.error('Error in proof verification', e)
      set({ status: { status: 'errored', error: e instanceof Error ? e.message : 'Unknown error at proof verification' } });

    }
  }
}));