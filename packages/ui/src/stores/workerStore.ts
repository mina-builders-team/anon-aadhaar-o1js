import { create } from 'zustand';
import { WorkerStatus } from '@/worker/worker';
import * as Comlink from 'comlink';
import type { API } from '../worker/worker';

const worker = new Worker(new URL('../worker/worker.ts', import.meta.url));
const proxy = Comlink.wrap<API>(worker);

interface WorkerState {
  status: WorkerStatus;
  initializeWorker: () => void;
  // [TODO] add the function(s) to create proofs
}

export const useWorkerStore = create<WorkerState>((set) => ({
  status: { status: 'uninitialized' },

  initializeWorker: () => {
    proxy.init();
    worker.onmessage = (event) => {
      try {
        const status = JSON.parse(event.data);
        if (Object.keys(status).includes('status')) {
          console.log(status);
          set({status: status});
        }
      } catch (e) {
        // do nothing
      }
    };
  },
}));
