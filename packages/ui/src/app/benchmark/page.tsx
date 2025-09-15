'use client'
import { useRef, useState } from 'react'
import * as Comlink from 'comlink'
import {
  DEMO_PRIVATEKEY,
  TEST_DATA,
  AADHAAR_TEST_PUBLIC_KEY,
} from 'anon-aadhaar-o1js'
import { PrivateKey } from 'o1js'
import type { SignatureWorkerAPI } from '../../worker/verifierWorker'
import type { ExtractorWorkerAPI } from '../../worker/extractorWorker'
import type { API as CredentialWorkerAPI } from '../../worker/credentialWorker'

export default function BenchmarkPage() {
  const [error, setError] = useState<string | null>(null)
  const [resultOk, setResultOk] = useState<boolean | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const [times, setTimes] = useState<{
    init?: number
    verifier?: number
    extractor?: number
    credential?: number
    total?: number
    totalAll?: number
  }>({})

  const allStartRef = useRef<number | null>(null)

  // Local worker proxies
  const verifierWorkerRef = useRef<Worker | null>(null)
  const extractorWorkerRef = useRef<Worker | null>(null)
  const credentialWorkerRef = useRef<Worker | null>(null)
  const verifierProxyRef = useRef<Comlink.Remote<SignatureWorkerAPI> | null>(
    null
  )
  const extractorProxyRef = useRef<Comlink.Remote<ExtractorWorkerAPI> | null>(
    null
  )
  const credentialProxyRef = useRef<Comlink.Remote<CredentialWorkerAPI> | null>(
    null
  )

  const ownerKey = PrivateKey.fromBase58(DEMO_PRIVATEKEY)
  const owner = ownerKey.toPublicKey()

  const ensureWorkers = async () => {
    if (!verifierWorkerRef.current) {
      verifierWorkerRef.current = new Worker(
        new URL('../../worker/verifierWorker.ts', import.meta.url),
        { type: 'module' }
      )
      verifierProxyRef.current = Comlink.wrap<SignatureWorkerAPI>(
        verifierWorkerRef.current
      )
    }
    if (!extractorWorkerRef.current) {
      extractorWorkerRef.current = new Worker(
        new URL('../../worker/extractorWorker.ts', import.meta.url),
        { type: 'module' }
      )
      extractorProxyRef.current = Comlink.wrap<ExtractorWorkerAPI>(
        extractorWorkerRef.current
      )
    }
    if (!credentialWorkerRef.current) {
      credentialWorkerRef.current = new Worker(
        new URL('../../worker/credentialWorker.ts', import.meta.url),
        { type: 'module' }
      )
      credentialProxyRef.current = Comlink.wrap<CredentialWorkerAPI>(
        credentialWorkerRef.current
      )
    }
    return {
      verifierProxy: verifierProxyRef.current!,
      extractorProxy: extractorProxyRef.current!,
      credentialProxy: credentialProxyRef.current!,
    }
  }

  const handleRun = async () => {
    try {
      setIsRunning(true)
      setError(null)
      setResultOk(null)
      setTimes({})
      allStartRef.current = performance.now()

      const { verifierProxy, extractorProxy, credentialProxy } =
        await ensureWorkers()

      // Initialization time (compile circuits)
      const initStart = performance.now()
      await verifierProxy.init()
      await extractorProxy.init()
      await credentialProxy.init()
      const init = performance.now() - initStart
      setTimes((t) => ({ ...t, init }))

      // Verifier
      const t1 = performance.now()
      const vProof = await verifierProxy.verifySignature(
        TEST_DATA,
        AADHAAR_TEST_PUBLIC_KEY
      )
      const verifier = performance.now() - t1
      setTimes((t) => ({ ...t, verifier }))
      if (!vProof) throw new Error('Verifier proof failed')

      // Extractor
      const t2 = performance.now()
      const eProof = await extractorProxy.extract(
        vProof,
        TEST_DATA,
        AADHAAR_TEST_PUBLIC_KEY
      )
      const extractor = performance.now() - t2
      setTimes((t) => ({ ...t, extractor }))
      if (!eProof) throw new Error('Extractor proof failed')

      // Credential
      const t3 = performance.now()
      const credentialJson = await credentialProxy.createCredential(
        eProof,
        owner.toBase58()
      )
      const credential = performance.now() - t3
      setTimes((t) => ({ ...t, credential }))
      if (!credentialJson) throw new Error('Credential creation failed')

      const total = verifier + extractor + credential
      const totalAll = performance.now() - (allStartRef.current as number)
      setTimes((t) => ({ ...t, total, totalAll }))
      setResultOk(true)
    } catch (e) {
      setResultOk(false)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsRunning(false)
    }
  }

  const fmt = (n?: number) => {
    if (typeof n !== 'number' || !isFinite(n)) return '—'
    return `${(n / 1000).toFixed(3)}s`
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-900 text-white">
      <div className="w-full max-w-xl p-6 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center">Benchmarking</h1>

        <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700">
          <button
            onClick={handleRun}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Run benchmark'}
          </button>

          {error && (
            <div className="text-left text-red-300 mt-3 text-sm">
              <p className="font-semibold">Error:</p>
              <p className="break-words">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="p-4 rounded-lg bg-gray-800/60 border border-gray-700">
          <h2 className="text-lg font-semibold">Results</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">Init:</div>
            <div className="text-white font-mono text-xs">{fmt(times.init)}</div>
            <div className="text-gray-400">Verifier:</div>
            <div className="text-white font-mono text-xs">{fmt(times.verifier)}</div>
            <div className="text-gray-400">Extractor:</div>
            <div className="text-white font-mono text-xs">{fmt(times.extractor)}</div>
            <div className="text-gray-400">Credential:</div>
            <div className="text-white font-mono text-xs">{fmt(times.credential)}</div>
            <div className="text-gray-400">Total (excl. init):</div>
            <div className="text-white font-mono text-xs">{fmt(times.total)}</div>
            <div className="text-gray-400">Total (incl. init):</div>
            <div className="text-white font-mono text-xs">{fmt(times.totalAll)}</div>
          </div>
          {resultOk === true && (
            <p className="text-green-400 text-sm mt-2">
              Credential created successfully.
            </p>
          )}
          {resultOk === false && !error && (
            <p className="text-red-300 text-sm mt-2">
              Credential creation failed.
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
