import * as Comlink from 'comlink';
import { WorkerStatus } from '@/worker_utils/utils';
import { loadProof, loadVK } from '@/worker_utils/dbHelpers';
import { AadhaarVerifierProof } from 'anon-aadhaar-o1js';
import { verify, VerificationKey, JsonProof } from "o1js";

function setStatus(status: WorkerStatus){
    self.postMessage(JSON.stringify(status))
}

async function verifyProof(
): Promise<boolean | null> {
    try {
        setStatus({ status: 'computing', message: 'Loading Aadhaar proof from IndexedDB' })

        const AadhaarProof = await loadProof('extractor-proof', 3)

        if (!AadhaarProof) {
            console.error('Aadhaar proof not found');
            return null
        }

        setStatus({ status: 'computing', message: 'Converting the proof from string to AadhaarVerifierProof' })
        const proof: JsonProof = JSON.parse(AadhaarProof)

        const verificationKeyString: string = await loadVK('aadhaar-vk', 3) 

        const verificationKey = VerificationKey.fromJSON(JSON.parse(verificationKeyString))
        console.log(verificationKey)
        const result = await verify(proof, verificationKey)
        console.log(result)
        return true
    } catch (error: unknown) {
        setStatus({ status: 'errored', error: error instanceof Error ? error.message : 'Extraction failed!' })
        console.error(error)
        return null
    }
}

const api = { 
  verifyProof
};

export type ProofVerificationWorkerAPI = typeof api;
Comlink.expose(api);