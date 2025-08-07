import * as Comlink from 'comlink';
import { fetchHashCacheFiles, fetchVerifierCacheFiles, MinaFileSystem, WorkerStatus } from '@/worker_utils/utils';
import { loadProof, saveProof } from "@/worker_utils/dbHelpers";
import { hashProgram, AadhaarVerifier, AadhaarVerifierProof, getQRData, createPaddedQRData, getDelimiterIndices } from "anon-aadhaar-o1js";
import { TEST_DATA } from "anon-aadhaar-o1js/build/src/getQRData";
import { JsonProof, Field, Cache } from "o1js";


let isInitialized = false
const proofsEnabled = true


function setStatus(status: WorkerStatus){
    self.postMessage(JSON.stringify(status))
}

setStatus({status: 'uninitialized'})

async function init() {
    const hashCacheFiles = await fetchHashCacheFiles();
    const verifierCacheFiles = await fetchVerifierCacheFiles();

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;

    setStatus({status: 'computing', message: 'Compiling Extractor Circuit'})
    // Before compiling extractor circuit, hashProgram must be compiled.
    console.time('hashProgram Compilation in Extractor')
    await hashProgram.compile({ proofsEnabled, cache: hashCache })
    console.timeEnd('hashProgram Compilation in Extractor')

    console.time('Extractor Circuit Compilation')
    await AadhaarVerifier.compile({ proofsEnabled, cache: verifierCache })
    console.timeEnd('Extractor Circuit Compilation')
    isInitialized = true
    setStatus({status: 'ready'})
}

async function extract(
): Promise<void> {
    if (!isInitialized) {
        console.log('Lan')
        setStatus({ status: 'errored', error: 'Worker seems to be not initialized. Please call init() first!' });
        return
    }

    try {
        setStatus({ status: 'computing', message: 'Loading previous proof from IndexedDB' })

        const verifierProofString = await loadProof('signature-proof', 3)

        if (!verifierProofString) {
            console.error('Verifier proof not found');
            return
        }

        setStatus({ status: 'computing', message: 'Executing Extraction' })
        const vp = JSON.parse(verifierProofString)
        console.log(vp)
        const verifierProof = await AadhaarVerifierProof.fromJSON(vp) 
        const inputs = getQRData(TEST_DATA)
        const paddedData = inputs.paddedData.toBytes()

        const data = createPaddedQRData(paddedData).map(Field)
        const delimiterIndices = getDelimiterIndices(paddedData)

        const currentYear = Field.from(2024)
        const currentMonth = Field.from(1)
        const currentDay = Field.from(1)

        const extractorProof = await AadhaarVerifier.extractor(verifierProof, data, delimiterIndices, currentYear, currentMonth, currentDay)
        const proofString = JSON.stringify(extractorProof)

        await saveProof('extractor-proof', proofString, 3);

        setStatus({ status: 'ready' })
    } catch (error: unknown) {
        setStatus({ status: 'errored', error: error instanceof Error ? error.message : 'Extraction failed!' })
        return
    }
}

async function cleanup() {
  try {

    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
    console.log('Extractor worker cleanup completed');
  } catch (e) {
    console.log('Cleanup error (non-critical):', e);
  }
}

const api = { 
  init, 
  extract,
  cleanup 
};

export type ExtractorWorkerAPI = typeof api;
Comlink.expose(api);