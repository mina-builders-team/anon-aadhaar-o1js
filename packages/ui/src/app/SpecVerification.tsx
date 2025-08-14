'use client';
import { useState } from 'react';
import { Credential } from 'mina-attestations';
import { PrivateKey } from 'o1js';
import { useWorkerStore } from '@/stores/workerStore';

type Props = {
  credentialJson?: string;
  ownerKey: PrivateKey;
};

export default function SpecVerification({ credentialJson, ownerKey }: Props) {
  const [requestJson, setRequestJson] = useState<string | undefined>();
  const [presentationJson, setPresentationJson] = useState<string | undefined>();
  const [outputClaim, setOutputClaim] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const { createPresentation } = useWorkerStore();

  const handleVerifyAge = async () => {
    try {
      if (!credentialJson) return;
      setBusy(true);
      // 1) fetch presentation request from server
      const res = await fetch('/api/presentation/request', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'request_failed');
      const reqJson = data.requestJson as string;
      setRequestJson(reqJson);

      // 2) create presentation in worker (compile off main thread)
      await Credential.fromJSON(credentialJson); // validate locally before offloading
      const presJson = await createPresentation({
        requestJson: reqJson,
        credentialJson,
        ownerPrivateKeyBase58: ownerKey.toBase58(),
      });
      if (!presJson) throw new Error('presentation_create_failed');
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-4 justify-center">
        <button onClick={handleVerifyAge} className="px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50" disabled={busy || !credentialJson}>
          Verify age &gt; 18
        </button>
      </div>
      <div className="space-y-2 text-sm text-gray-300">
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
  );
}
