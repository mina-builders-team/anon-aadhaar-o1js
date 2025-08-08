import * as Comlink from 'comlink';
import { WorkerStatus } from '@/worker_utils/utils';
import { AadhaarVerifierProof } from 'anon-aadhaar-o1js';
import { verify, VerificationKey, JsonProof } from "o1js";


async function verifyProof(
    verificationKey: string,
    extractorProof: string
): Promise<boolean | null> {
    try {
        console.log('Converting the proof from string to AadhaarVerifierProof')
        const AadhaarProofJson = JSON.parse(extractorProof);

        const AadhaarProof = await AadhaarVerifierProof.fromJSON(AadhaarProofJson as JsonProof);
        
        const verificationKeyString = JSON.parse(verificationKey)
        const vk = VerificationKey.fromJSON(verificationKeyString)

        const result = await verify(AadhaarProof, vk)
        return result
    } catch (error: unknown) {
        console.log('Extraction failed!')
        console.error(error)
        return null
    }
}

const api = { 
  verifyProof
};

export type ProofVerificationWorkerAPI = typeof api;
Comlink.expose(api);