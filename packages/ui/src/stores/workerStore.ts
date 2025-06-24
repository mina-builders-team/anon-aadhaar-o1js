import { create } from 'zustand';
import { WorkerStatus } from '@/worker/worker';
import * as Comlink from 'comlink';
import type { API } from '../worker/worker';

let worker: Worker | null = null;
let proxy: Comlink.Remote<API> | null = null;

const initWorker = () => {
  if (typeof window !== 'undefined' && !worker) {
    worker = new Worker(new URL('../worker/worker.ts', import.meta.url));
    proxy = Comlink.wrap<API>(worker);
  }
};

interface WorkerState {
  status: WorkerStatus;
  initializeWorker: () => void;
  // [TODO] add the function(s) to create proofs
}

export const useWorkerStore = create<WorkerState>((set) => ({
  status: { status: 'uninitialized' },

  initializeWorker: () => {
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
}));
