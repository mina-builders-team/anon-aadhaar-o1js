'use client';
import { useEffect, useState } from 'react';
import { useWorkerStore } from '@/stores/workerStore';
import { TEST_DATA } from 'anon-aadhaar-o1js';
import { PrivateKey } from 'o1js';
import { Credential, Presentation, PresentationRequest } from 'mina-attestations';

export default function Page() {
  const { status, isInitialized, initialize, createCredential } = useWorkerStore();
  const [credentialJson, setCredentialJson] = useState<string | undefined>();
  const [requestJson, setRequestJson] = useState<string | undefined>();
  const [presentationJson, setPresentationJson] = useState<string | undefined>();
  const [outputClaim, setOutputClaim] = useState<string | undefined>();
  const ownerKey = PrivateKey.random();
  const owner = ownerKey.toPublicKey();
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  const handleCreateCredential = async () => {
    const res = await createCredential(TEST_DATA, owner);
    if (res?.credentialJson) setCredentialJson(res.credentialJson);
  };

  const handleVerifyAge = async () => {
    try {
      if (!credentialJson) return;
      // 1) fetch presentation request from server
      console.time('fetch request')
      const res = await fetch('/api/presentation/request', { method: 'POST' });
      console.timeEnd('fetch request')
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'request_failed');
      const reqJson = data.requestJson as string;
      setRequestJson(reqJson);

      // 2) compile and create presentation
      console.time('compile PresentationRequest')
      const deserialized = PresentationRequest.fromJSON('https', reqJson);
      const compiled = await Presentation.compile(deserialized);
      console.timeEnd('compile PresentationRequest')
      console.time('create Presentation')
      const storedCredential = await Credential.fromJSON(credentialJson);
      const presentation = await Presentation.create(ownerKey, {
        request: compiled,
        credentials: [{ ...storedCredential, key: 'credential' }],
        context: { verifierIdentity: 'anon-aadhaar-o1js.demo' },
      });
      console.timeEnd('create Presentation')
      const presJson = Presentation.toJSON(presentation);
      setPresentationJson(presJson);

      // 3) verify on server
      const vres = await fetch('/api/presentation/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestJson: reqJson, presentationJson: presJson })
      });
      const vdata = await vres.json();
      if (!vres.ok || !vdata.ok) throw new Error(vdata?.error || 'verification_failed');
      setOutputClaim(vdata.outputClaim as string);
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-400';
      case 'errored': return 'text-red-400';
      case 'computing': return 'text-blue-400';
      case 'uninitialized': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-900 text-white">
      <div className="w-full max-w-xl p-6 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Aadhaar Proof Process</h1>
        
        <div className="text-center">
          <p className={`font-mono ${getStatusColor(status.status)}`}>
            {status.status}: {("message" in status) ? ` ${status.message}` : ''}
          </p>
          {status.status === 'errored' && status.error && (
            <div className="text-center text-red-300 mt-2 text-sm">
              <p className="font-semibold">Error:</p>
              <p className="break-words">{status.error}</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Workers initialized: {isInitialized ? '✓' : '✗'}
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <button onClick={handleCreateCredential} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50" disabled={status.status === 'computing' || !isInitialized}>
            Create Credential
          </button>
          <button onClick={handleVerifyAge} className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50" disabled={status.status === 'computing' || !credentialJson}>
            Verify age &gt; 18
          </button>
        </div>

        <div className="space-y-2 text-sm text-gray-300">
          <div>Credential: {credentialJson ? 'ready' : 'not ready'}</div>
          <div>Request: {requestJson ? 'ready' : 'not ready'}</div>
          <div>Presentation: {presentationJson ? 'ready' : 'not ready'}</div>
          {outputClaim && (
            <div className="mt-2 p-2 bg-gray-700 rounded">
              <div className="font-semibold">Output Claim</div>
              <div className="break-all">{outputClaim}</div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}