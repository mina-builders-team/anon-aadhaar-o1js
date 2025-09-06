'use client';
import { useState } from 'react';
import { Credential } from 'mina-attestations';
import { PrivateKey } from 'o1js';
import { useWorkerStore } from '@/stores/workerStore';

interface OutputClaim {
  pubKeyHash: string;
  owner: string;
}

type Props = {
  credentialJson?: string;
  ownerKey: PrivateKey;
  aadhaarEnv: 'test' | 'prod';
};

export default function SpecVerification({ credentialJson, ownerKey, aadhaarEnv }: Props) {
  const [requestJson, setRequestJson] = useState<string | undefined>();
  const [presentationJson, setPresentationJson] = useState<string | undefined>();
  const [outputClaim, setOutputClaim] = useState<OutputClaim | undefined>();
  const [buttonText, setButtonText] = useState('Verify age > 18');
  const { createPresentation } = useWorkerStore();

  const handleVerifyAge = async () => {
    try {
      if (!credentialJson) return;
      setButtonText('Fetching presentation requests...');
      // 1) fetch presentation request from server
      const res = await fetch('/api/presentation/request', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'request_failed');
      const reqJson = data.requestJson as string;
      setRequestJson(reqJson);

      setButtonText('Creating presentation...');
      // 2) create presentation in worker
      console.time("presentation creation took")
      await Credential.fromJSON(credentialJson); // validate locally before offloading
      const presJson = await createPresentation({
        requestJson: reqJson,
        credentialJson,
        ownerPrivateKeyBase58: ownerKey.toBase58(),
      });
      console.timeEnd("presentation creation took")
      if (!presJson) throw new Error('presentation_create_failed');
      setPresentationJson(presJson);

      setButtonText('Verifying presentation...');
      // 3) verify on server
      console.time('verifying on server')
      const vres = await fetch('/api/presentation/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestJson: reqJson, presentationJson: presJson, environment: aadhaarEnv })
      });
      console.timeEnd('verifying on server')
      const vdata = await vres.json();
      if (!vdata.ok) throw new Error(vdata?.error || 'verification_failed');
      console.log("vdata.outputClaim.pubKeyHash", vdata)
      setOutputClaim(JSON.parse(vdata.outputClaim));
      setButtonText('Verified');
    } catch (e) {
      console.error(e);
      setButtonText('Verify age > 18');
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-2xl mx-auto">
      <button
        onClick={handleVerifyAge}
        className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-500 disabled:opacity-50 transition-colors"
        disabled={buttonText !== 'Verify age > 18' || !credentialJson}
      >
        {buttonText}
      </button>
      {outputClaim && (
        <div className="w-full p-4 rounded-lg borde shadow-sm">
          <div className="space-y-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Owner:</span>
              <span className="font-mono text-sm break-all text-gray-500">{outputClaim.owner}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Issuer Public Key Hash:</span>
              <span className="font-mono text-sm break-all text-gray-500">{outputClaim.pubKeyHash}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
