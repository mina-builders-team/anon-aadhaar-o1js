import * as Comlink from 'comlink';
import { fetchHashCacheFiles, fetchVerifierCacheFiles, MinaFileSystem } from '@/worker_utils/utils';
import { hashProgram, AadhaarVerifier, AadhaarVerifierProof, getQRData, createPaddedQRData } from 'anon-aadhaar-o1js';
import { JsonProof, Field, Cache } from "o1js";


let isInitialized = false
const proofsEnabled = true


async function init() {
    const hashCacheFiles = await fetchHashCacheFiles();
    const verifierCacheFiles = await fetchVerifierCacheFiles();

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;

    console.time('hashProgram Compilation in Extractor')
    await hashProgram.compile({ proofsEnabled, cache: hashCache })
    console.timeEnd('hashProgram Compilation in Extractor')

    console.time('AadhaarVerifier Circuit Compilation')
    await AadhaarVerifier.compile({ proofsEnabled, cache: verifierCache })
    console.timeEnd('AadhaarVerifier Circuit Compilation')
    isInitialized = true
    console.log('Extractor Worker is ready')
}

async function extract(
  verifierProofString: string,
  qrNumericString: string,
  publicKeyHex: string
): Promise<string | null> {
    if (!isInitialized) {
        console.log('Extractor worker seems to be not initialized. Please call init() first!')
        return null;
    }
    try {
        console.log('Executing Extraction Method')
        const vp: JsonProof = JSON.parse(verifierProofString)
        const verifierProof = await AadhaarVerifierProof.fromJSON(vp) 
        const inputs = getQRData(qrNumericString, publicKeyHex)
        const paddedData = inputs.paddedData.toBytes()

        const data = createPaddedQRData(paddedData).map(Field)

        console.time('extractor')
        const { proof } = await AadhaarVerifier.extractor(verifierProof, data)
        console.timeEnd('extractor')
        const proofString = JSON.stringify(proof.toJSON())

        console.log('Extractor proof ready')
        return proofString
    } catch (error: unknown) {
        console.log('Extraction failed!', error)
        return null
    }
}

const api = { 
  init, 
  extract,
};

export type ExtractorWorkerAPI = typeof api;
Comlink.expose(api);