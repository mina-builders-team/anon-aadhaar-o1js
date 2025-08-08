import * as Comlink from 'comlink';
import { fetchHashCacheFiles, fetchVerifierCacheFiles, MinaFileSystem } from '@/worker_utils/utils';
import { hashProgram, AadhaarVerifier, AadhaarVerifierProof, getQRData, createPaddedQRData } from "anon-aadhaar-o1js";
import { TEST_DATA } from "anon-aadhaar-o1js/build/src/getQRData";
import { JsonProof, Field, Cache } from "o1js";


let isInitialized = false
const proofsEnabled = true


async function init() {
    const hashCacheFiles = await fetchHashCacheFiles();
    const verifierCacheFiles = await fetchVerifierCacheFiles();

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;

    console.log('Compiling Extractor Circuit')
    // Before compiling extractor circuit, hashProgram must be compiled.
    console.time('hashProgram Compilation in Extractor')
    await hashProgram.compile({ proofsEnabled, cache: hashCache })
    console.timeEnd('hashProgram Compilation in Extractor')

    console.time('Extractor Circuit Compilation')
    await AadhaarVerifier.compile({ proofsEnabled, cache: verifierCache })
    console.timeEnd('Extractor Circuit Compilation')
    isInitialized = true
    console.log('Extractor Circuit is ready')
}

async function extract(
  verifierProofString: string
): Promise<string | null> {
    if (!isInitialized) {
        console.log('Extractor worker seems to be not initialized. Please call init() first!')
        return null;
    }
    try {
        console.log('Executing Extraction')
        const vp: JsonProof = JSON.parse(verifierProofString)
        console.log(vp)

        const verifierProof = await AadhaarVerifierProof.fromJSON(vp) 
        const inputs = getQRData(TEST_DATA)
        const paddedData = inputs.paddedData.toBytes()

        const data = createPaddedQRData(paddedData).map(Field)

        const currentYear = Field.from(2024)
        const currentMonth = Field.from(1)
        const currentDay = Field.from(1)

        const { proof } = await AadhaarVerifier.extractor(verifierProof, data, currentYear, currentMonth, currentDay)
        const proofString = JSON.stringify(proof.toJSON())

        console.log('Extraction ready')
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