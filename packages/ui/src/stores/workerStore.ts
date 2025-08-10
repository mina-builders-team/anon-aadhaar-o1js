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

let verifierProof: string | null = null;
let extractorProof: string | null = null;
let verificationKey: string | null = null;

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
  proofVerificationProxy: Comlink.Remote<ProofVerificationWorkerAPI> | null;
  verifySignature: () => Promise<void>;
  extractor: () => Promise<void>;
  verifyProof: () => Promise<boolean | null>;
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
  proofVerificationProxy: null,
  
  initializeVerifierWorker: async () => {
    initVerifierWorker();
    if (!verifierWorker || !verifierProxy) return;

    set({ verifierProxy });
    const res = await verifierProxy.init();

    if(!res){
      console.error('Somethings problematic in verificationKey store!')
      return
    }
    verificationKey = res
  },

  
  initializeExtractorWorker: async () => {
    initExtractorWorker();
    if (!extractorWorker || !extractorProxy) return;
  
    set({ extractorProxy });

    await extractorProxy.init()
  },

  initializeProofVerificationWorker: async () => {
    initProofVerificationWorker()
    if (!proofVerificationProxy || !proofVerificationWorker) return;

    set({proofVerificationProxy})
  },
    

  verifySignature: async () => {
    const { verifierProxy } = get();
    if (!verifierProxy) {
      console.error('Verifier worker not initialized');
      return;
    }
    try {
      const resultProof = await verifierProxy.verifySignature();

      if(!resultProof){
        console.error('Somethings problematic in verifySignature');
        return;
      }
      verifierProof = resultProof
      
      set({ status: {status:'computed', message: 'Computed Verifier Proof'} });
      console.log('Terminating verifier worker to free WASM memory');
    } catch (e) {
      console.error('Error verifying signature', e);

      set({ status: { status: 'errored', error: e instanceof Error ? e.message : 'Unknown error at verification' } });
    }
  },

  extractor: async () => {
    let { extractorProxy } = get();

    if (!extractorWorker || !extractorProxy) {
      console.log('Re-initializing extractor worker');
      await get().initializeExtractorWorker();
    }

    const updatedState = get();
    extractorProxy = updatedState.extractorProxy;

    if (!extractorProxy) {
      console.error('Extractor worker is not initialized');
      return;
    }

    try {
      if(!verifierProof){
        console.error('verifierProof does not exist!')
        return;
      }
      const resultProof = await extractorProxy.extract(verifierProof);

      if(!resultProof){
        console.log('Somethings problematic in extractor store!')
        return;
      }

      extractorProof = resultProof

    } catch (e) {
      console.error('Error in extraction', e);
      set({ status: { status: 'errored', error: e instanceof Error ? e.message : 'Unknown error at extraction' } });
    }
  },

  verifyProof: async (): Promise<boolean | null> => {
    if(!proofVerificationWorker || !proofVerificationProxy){
      console.error('Proof verification worker is not initialized')
      return null
    }
    
    try{
      if(!verificationKey || !extractorProof){
        console.error('Verification Key or Extarctor proof is not valid!')
        return null;
      }
      
      const res = await proofVerificationProxy.verifyProof(verificationKey, extractorProof)
      return res
    } catch(e){
      console.error('Error in proof verification', e)
      set({ status: { status: 'errored', error: e instanceof Error ? e.message : 'Unknown error at proof verification' } });
      return null;
    }
  }
}));