import * as Comlink from 'comlink'
import { Cache, PublicKey } from 'o1js'
import {
  fetchHashCacheFiles,
  fetchVerifierCacheFiles,
  MinaFileSystem,
} from '@/worker_utils/utils'
import { Credential } from 'mina-attestations'
import {
  hashProgram,
  AadhaarVerifier,
  AadhaarVerifierProof,
  AadhaarCredentialFactory,
} from 'anon-aadhaar-o1js'

let isInitialized = false
const proofsEnabled = true

/**
 * Initialize the worker by compiling the circuits
 */
async function init() {
  try {
    const hashCacheFiles = await fetchHashCacheFiles()
    const verifierCacheFiles = await fetchVerifierCacheFiles()

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache

    console.time('hashProgram Compilation')
    await hashProgram.compile({ proofsEnabled, cache: hashCache })
    console.timeEnd('hashProgram Compilation')

    console.time('AadhaarVerifier Compilation')
    await AadhaarVerifier.compile({ proofsEnabled, cache: verifierCache })
    console.timeEnd('AadhaarVerifier Compilation')

    console.time('AadhaarCredential Compilation')
    const aadhaarCredential = await AadhaarCredentialFactory()
    await aadhaarCredential.compile()
    console.timeEnd('AadhaarCredential Compilation')
    console.log('Credential Worker is ready')
    isInitialized = true
    return true
  } catch (e) {
    console.error('Error occured: ', e)
    return false
  }
}

/**
 * Simulates the main computation workload
 */
async function createCredential(
  aadhaarVerifierProofString: string,
  ownerPublicKey: string
) {
  if (!isInitialized) {
    console.error('Worker is not initialized. Please call init() first.')
    return
  }

  const aadhaarVerifierProof = await AadhaarVerifierProof.fromJSON(
    JSON.parse(aadhaarVerifierProofString)
  )
  const aadhaarCredential = await AadhaarCredentialFactory()
  console.time('createCredential')
  const credential = await aadhaarCredential.create({
    owner: PublicKey.fromBase58(ownerPublicKey),
    publicInput: {},
    privateInput: {
      aadhaarVerifierProof: aadhaarVerifierProof,
    },
  })
  console.timeEnd('createCredential')
  console.log('Credential created')
  return Credential.toJSON(credential)
}

const api = {
  init,
  createCredential,
}

export type API = typeof api

Comlink.expose(api)
