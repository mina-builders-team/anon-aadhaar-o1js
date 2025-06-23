'use client';

import { useEffect } from 'react';
import { useWorkerStore } from '../stores/workerStore';

export default function Page() {
  const { status, initializeWorker } = useWorkerStore();

  useEffect(() => {
    if (status.status === 'uninitialized') {
      initializeWorker();
    }
  }, [initializeWorker, status.status]);

  const statusColor =
    status.status === 'ready'
      ? 'text-green-400'
      : status.status === 'errored'
      ? 'text-red-400'
      : 'text-yellow-400';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <div className="p-4 text-center bg-gray-700 rounded-md">
          <p className="text-lg font-semibold">
            Worker Status: <span className={`font-mono ${statusColor}`}>{status.status}</span>
          </p>
          {status.status === 'computing' && (
            <p className="mt-2 text-sm text-gray-300 h-6">{status.message}</p>
          )}
          {status.status === 'errored' && (
            <div className="p-4 mt-4 text-center bg-red-900 border border-red-700 rounded-md">
              <p className="mt-1 text-red-300">{status.error}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
