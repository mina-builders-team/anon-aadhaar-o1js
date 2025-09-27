'use client';
import { useState, useEffect } from 'react';
import { Credential, Presentation, PresentationRequest } from 'mina-attestations';
import { Field, PrivateKey } from 'o1js';
import { useWorkerStore } from '@/stores/workerStore';
import { ProgressSteps, type StepItem } from '@/components/ProgressSteps';
import { ageMoreThan18Spec } from 'anon-aadhaar-o1js';

interface OutputClaim {
  pubKeyHash: string;
  owner: string;
}

type Props = {
  credentialJson?: string;
  ownerKey: PrivateKey;
  aadhaarEnv: 'test' | 'prod';
  disabled?: boolean;
};

export default function SpecVerification({ credentialJson, ownerKey, aadhaarEnv, disabled }: Props) {
  const [requestJson, setRequestJson] = useState<string | undefined>();
  const [presentationJson, setPresentationJson] = useState<string | undefined>();
  const [outputClaim, setOutputClaim] = useState<OutputClaim | undefined>();
  const [buttonText, setButtonText] = useState('Verify age > 18');
  const { createPresentation, status } = useWorkerStore();
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [progressActive, setProgressActive] = useState(false);

  const handleVerifyAge = async () => {
    try {
      if (!credentialJson) return;
      setSteps([]);
      setProgressActive(true);
      setButtonText('Fetching presentation requests...');
      // Append fetch step as active
      setSteps((prev) => [
        ...prev,
        { id: 'fetch', label: 'Fetch presentation request', status: 'active' },
      ]);

      const spec = await ageMoreThan18Spec()
      const now = new Date()
      const currentDay = Field.from(now.getUTCDate())
      const currentMonth = Field.from(now.getUTCMonth() + 1)
      const currentYear = Field.from(now.getUTCFullYear())

      const request = PresentationRequest.https(
        spec,
        {
          currentDay,
          currentMonth,
          currentYear,
        },
        { action: 'anon-aadhaar:age-check' }
      )
      console.log(
        `currentDay: ${currentDay.toString()}, currentMonth: ${currentMonth.toString()}, currentYear: ${currentYear.toString()}`
      )
      const reqJson = PresentationRequest.toJSON(request)

      setRequestJson(reqJson);
      // Mark fetch step done
      setSteps((prev) => {
        const up = [...prev];
        const last = up.at(-1);
        if (last && last.status === 'active') up[up.length - 1] = { ...last, status: 'done' };
        return up;
      });

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
      // Append verify step as active
      setSteps((prev) => [
        ...prev,
        { id: 'verify', label: 'Verify on server', status: 'active' },
      ]); 
      // 3) verify on server

      if (!requestJson || !presentationJson) {
        return setButtonText('Could not found request or presentation!');
      }
      console.time('verifying Presentation took')

      const presentation = Presentation.fromJSON(presentationJson)
      const outputClaim = await Presentation.verify(request, presentation, {
        verifierIdentity: 'anon-aadhaar-o1js.demo',
      })
      console.timeEnd('verifying Presentation took')
      console.time('verifying on server')

      console.timeEnd('verifying on server')
      if (!outputClaim) throw new Error('Verification failed!');
      console.log("vdata.outputClaim.pubKeyHash", outputClaim.pubKeyHash)
      setOutputClaim({
        owner: outputClaim.owner.toBase58(),
        pubKeyHash: outputClaim.pubKeyHash
      });

      setButtonText('Verified');
      // Mark verify as done
      setSteps((prev) => {
        const up = [...prev];
        const last = up.at(-1);
        if (last && last.status === 'active') up[up.length - 1] = { ...last, status: 'done' };
        return up;
      });
    } catch (e) {
      console.error(e);
      setButtonText('Verify age > 18');
      // Mark current active as error
      setSteps((prev) => {
        const up = [...prev];
        const last = up.at(-1);
        if (last && last.status === 'active') up[up.length - 1] = { ...last, status: 'error' };
        return up;
      });
    }
  };

  // Reflect worker status for the create presentation step
  useEffect(() => {
    if (!progressActive) return;
    const newStatus = status;
    setSteps((prevSteps) => {
      const updated = [...prevSteps];
      const markLastActive = (state: 'done' | 'error', labelOverride?: string) => {
        const last = updated.at(-1);
        if (last && last.status === 'active') {
          updated[updated.length - 1] = {
            ...last,
            status: state === 'done' ? 'done' : 'error',
            label: labelOverride ?? last.label,
          };
        }
      };
      if (newStatus.status === 'computing') {
        // Start a worker-driven step (e.g., Creating presentation)
        // Close any existing active step only if it's a worker-labelled step already present
        // We simply push a new active step with the worker message
        updated.push({ id: `worker-${updated.length + 1}`, label: newStatus.message, status: 'active' });
      } else if (newStatus.status === 'computed') {
        markLastActive('done', newStatus.message);
      } else if (newStatus.status === 'errored') {
        markLastActive('error');
      }
      return updated;
    });
  }, [status]);

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-2xl mx-auto">
      <button
        onClick={handleVerifyAge}
        className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-500 disabled:opacity-50 transition-colors"
        disabled={buttonText !== 'Verify age > 18' || !credentialJson || disabled}
      >
        {buttonText}
      </button>
      {/* Progress for presentation flow (visible only after click) */}
      {progressActive && (
        <div className="w-full">
          <ProgressSteps title="Progress" steps={steps} />
        </div>
      )}
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
