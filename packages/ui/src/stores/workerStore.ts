import { create } from 'zustand'
import { WorkerStatus } from '@/worker_utils/utils'
import * as Comlink from 'comlink'
import type { SignatureWorkerAPI } from '../worker/verifierWorker'
import type { ExtractorWorkerAPI } from '../worker/extractorWorker'
import type { ProofVerificationWorkerAPI } from '@/worker/proofVerificationWorker'
import type { API } from '../worker/credentialWorker'
import type { PresentationWorkerAPI } from '../worker/presentationWorker'
import { PublicKey } from 'o1js'
import { Credential } from 'mina-attestations'

let verifierWorker: Worker | null = null
let verifierProxy: Comlink.Remote<SignatureWorkerAPI> | null = null
let extractorWorker: Worker | null = null
let extractorProxy: Comlink.Remote<ExtractorWorkerAPI> | null = null
let proofVerificationWorker: Worker | null = null
let proofVerificationProxy: Comlink.Remote<ProofVerificationWorkerAPI> | null =
  null
let credentialWorker: Worker | null = null
let credentialProxy: Comlink.Remote<API> | null = null
let presentationWorker: Worker | null = null
let presentationProxy: Comlink.Remote<PresentationWorkerAPI> | null = null

let verificationKey: string | null = null

const createWorkers = () => {
  if (typeof window !== 'undefined' && !credentialWorker) {
    verifierWorker = new Worker(
      new URL('../worker/verifierWorker.ts', import.meta.url),
      { type: 'module' }
    )
    verifierProxy = Comlink.wrap<SignatureWorkerAPI>(verifierWorker)
    extractorWorker = new Worker(
      new URL('../worker/extractorWorker.ts', import.meta.url),
      { type: 'module' }
    )
    extractorProxy = Comlink.wrap<ExtractorWorkerAPI>(extractorWorker)
    proofVerificationWorker = new Worker(
      new URL('../worker/proofVerificationWorker.ts', import.meta.url),
      { type: 'module' }
    )
    proofVerificationProxy = Comlink.wrap<ProofVerificationWorkerAPI>(
      proofVerificationWorker
    )
    credentialWorker = new Worker(
      new URL('../worker/credentialWorker.ts', import.meta.url),
      { type: 'module' }
    )
    credentialProxy = Comlink.wrap<API>(credentialWorker)
    presentationWorker = new Worker(
      new URL('../worker/presentationWorker.ts', import.meta.url),
      { type: 'module' }
    )
    presentationProxy = Comlink.wrap<PresentationWorkerAPI>(presentationWorker)
  }
}

interface WorkerState {
  isInitialized: boolean
  status: WorkerStatus
  initialize: () => Promise<void>
  createCredential: (
    qrNumericString: string,
    owner: string,
    publicKeyHex: string
  ) => Promise<
    { credentialJson: string; aadhaarVerifierProof: string } | undefined
  >
  verifyAadhaarVerifierProof: (aadhaarVerifierProof: string) => Promise<boolean>
  createPresentation: (args: {
    requestJson: string
    credentialJson: string
    ownerPrivateKeyBase58: string
  }) => Promise<string | undefined>
}

export const useWorkerStore = create<WorkerState>((set, get) => ({
  isInitialized: false,
  status: { status: 'uninitialized' },

  initialize: async () => {
    if (get().isInitialized) return
    set({ status: { status: 'computing', message: 'Initializing workers' } })
    createWorkers()

    if (
      !verifierProxy ||
      !extractorProxy ||
      !credentialProxy ||
      !proofVerificationProxy ||
      !presentationProxy
    ) {
      set({
        status: { status: 'errored', error: 'Worker instantiation failed' },
      })
      return
    }
    try {
      const res = await verifierProxy.init()
      if (!res) {
        set({
          status: {
            status: 'errored',
            error: 'Failed to initialize verification key',
          },
        })
        return
      }
      verificationKey = res
      await extractorProxy.init()
      await credentialProxy.init()

      set({ isInitialized: true, status: { status: 'ready' } })
    } catch (e) {
      set({
        isInitialized: false,
        status: {
          status: 'errored',
          error:
            e instanceof Error ? e.message : 'Unknown initialization error',
        },
      })
    }
  },

  createCredential: async (
    qrNumericString: string,
    owner: string,
    publicKeyHex: string
  ) => {
    console.log(
      'Executing Credential Creation Method, qrNumericString: ',
      qrNumericString
    )
    if (!get().isInitialized) {
      await get().initialize()
      if (!get().isInitialized) return undefined
    }
    if (
      !verifierProxy ||
      !extractorProxy ||
      !credentialProxy ||
      !proofVerificationProxy
    ) {
      set({ status: { status: 'errored', error: 'Workers not ready' } })
      return undefined
    }
    try {
      set({
        status: { status: 'computing', message: 'Computing Verifier Proof' },
      })
      console.time('total time')
      console.time('verifierWorker took')
      const vProof = await verifierProxy.verifySignature(
        qrNumericString,
        publicKeyHex
      )
      console.timeEnd('verifierWorker took')
      if (!vProof) {
        set({ status: { status: 'errored', error: 'Verifier proof failed' } })
        return undefined
      }

      set({
        status: { status: 'computing', message: 'Computing Extractor Proof' },
      })
      console.time('extractorWorker took')
      const eProof = await extractorProxy.extract(
        vProof,
        qrNumericString,
        publicKeyHex
      )
      console.timeEnd('extractorWorker took')
      if (!eProof) {
        set({ status: { status: 'errored', error: 'Extractor proof failed' } })
        return undefined
      }

      set({ status: { status: 'computing', message: 'Creating Credential' } })
      console.time('credentialWorker took')
      const credentialString = await credentialProxy.createCredential(
        eProof,
        owner
      )
      console.timeEnd('credentialWorker took')
      if (!credentialString) {
        set({
          status: { status: 'errored', error: 'Credential creation failed' },
        })
        return undefined
      }
      await Credential.fromJSON(credentialString)
      console.timeEnd('total time')
      set({ status: { status: 'computed', message: 'Credential created' } })
      return { credentialJson: credentialString, aadhaarVerifierProof: eProof }
    } catch (e) {
      set({
        status: {
          status: 'errored',
          error:
            e instanceof Error
              ? e.message
              : 'Unknown error during credential creation',
        },
      })
      return undefined
    }
  },

  verifyAadhaarVerifierProof: async (aadhaarVerifierProof: string) => {
    if (!verificationKey) {
      set({ status: { status: 'errored', error: 'Missing verification key' } })
      return false
    }
    if (!proofVerificationProxy) {
      set({ status: { status: 'errored', error: 'Workers not ready' } })
      return false
    }
    set({
      status: { status: 'computing', message: 'Verifying Extractor Proof' },
    })
    const ok = await proofVerificationProxy.verifyProof(
      verificationKey,
      aadhaarVerifierProof
    )
    if (ok === null) {
      set({ status: { status: 'errored', error: 'Proof verification failed' } })
      return false
    }
    set({ status: { status: 'computed', message: 'Proof verified' } })
    return ok
  },

  createPresentation: async ({
    requestJson,
    credentialJson,
    ownerPrivateKeyBase58,
  }) => {
    if (!presentationProxy || !presentationWorker) {
      presentationWorker = new Worker(
        new URL('../worker/presentationWorker.ts', import.meta.url),
        { type: 'module' }
      )
      presentationProxy =
        Comlink.wrap<PresentationWorkerAPI>(presentationWorker)
    }
    set({ status: { status: 'computing', message: 'Creating presentation' } })
    console.time('presentationWorker took')
    const presJson = await presentationProxy.createPresentation(
      requestJson,
      credentialJson,
      ownerPrivateKeyBase58
    )
    console.timeEnd('presentationWorker took')
    if (!presJson) {
      set({
        status: { status: 'errored', error: 'Presentation creation failed' },
      })
      return undefined
    }
    set({ status: { status: 'computed', message: 'Presentation created' } })
    return presJson
  },
}))
