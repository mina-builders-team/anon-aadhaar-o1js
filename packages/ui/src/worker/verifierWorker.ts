import * as Comlink from 'comlink'
import { Cache } from 'o1js'
import {
  fetchHashCacheFiles,
  fetchVerifierCacheFiles,
  MinaFileSystem,
} from '@/worker_utils/utils'
import {
  AadhaarVerifier,
  hashProgram,
  prepareRecursiveHashData,
  getQRData,
} from 'anon-aadhaar-o1js'

let isInitialized = false

async function init() {
  try {
    console.log('Compiling Hash Circuit')
    const hashCacheFiles = await fetchHashCacheFiles()
    const verifierCacheFiles = await fetchVerifierCacheFiles()

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache

    console.time('hashProgram Compilation')
    await hashProgram.compile({ cache: hashCache })
    console.timeEnd('hashProgram Compilation')

    console.time('AadhaarVerifier Compilation')
    const aadhaarVK = await AadhaarVerifier.compile({ cache: verifierCache })
    console.timeEnd('AadhaarVerifier Compilation')

    console.log('Verifier Worker is ready')

    isInitialized = true

    const aadhaarVKString = JSON.stringify(aadhaarVK.verificationKey)

    return aadhaarVKString
  } catch (e) {
    console.error('Error occured: ', e)
  }
}

async function verifySignature(qrNumericString: string, publicKeyHex: string) {
  if (!isInitialized) {
    console.error('Worker is not initialized. Please call init() first')
    return
  }

  try {
    console.log('Executing Signature Verification Method')

    const inputs = getQRData(qrNumericString, publicKeyHex)
    const blocks = prepareRecursiveHashData(inputs.signedData)
    console.time('verifySignature')
    const { proof } = await AadhaarVerifier.verifySignature(
      blocks,
      inputs.signatureBigint,
      inputs.publicKeyBigint
    )
    console.timeEnd('verifySignature')
    const proofString = JSON.stringify(proof.toJSON())

    console.log('verifySignature proof ready')

    return proofString
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(error.message)
    } else {
      console.log('Verification failed!')
    }
  }
}

const api = {
  init,
  verifySignature,
}

export type SignatureWorkerAPI = typeof api
Comlink.expose(api)
