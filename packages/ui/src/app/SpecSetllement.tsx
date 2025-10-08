'use client'
import { useWorkerStore } from '@/stores/workerStore'
import { useMinaProvider } from '@/context/MinaProviderContext'
import { Mina } from 'o1js'
import { MINA_ARCHIVE_ENDPOINT, MINA_NODE_ENDPOINT } from 'anon-aadhaar-o1js'
import { useState } from 'react'

type Props = {
  proofJson: string
  zkAppPublicKey: string
}

export default function SpecSettlement({ proofJson, zkAppPublicKey }: Props) {
  const { settleProof } = useWorkerStore() // Updated method name
  const { provider, walletError } = useMinaProvider()
  const [txResult, setTxResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSettlement = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setTxResult(null)

      if (!proofJson) throw new Error('No valid proof is found!')
      if (!provider) throw new Error('Mina provider not available!')

      const proof = JSON.parse(proofJson)
      if (!proof) {
        throw new Error('Error on SpecSettlement - No credential found')
      }

      // Get accounts from provider
      const accounts = await provider.getAccounts()
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found')
      }
      const senderAddress = accounts[0]

      // Prepare transaction in worker (heavy computation)
      console.log('Preparing settlement transaction...')
      const txJson = await settleProof(proofJson, zkAppPublicKey, senderAddress)
      if (!txJson) {
        throw new Error('Failed to prepare transaction')
      }

      // Set up network in main thread for sending
      const network = Mina.Network({
        mina: MINA_NODE_ENDPOINT,
        archive: MINA_ARCHIVE_ENDPOINT,
      })
      Mina.setActiveInstance(network)

      // Send transaction using the provider (wallet interaction)
      console.log('Sending transaction...')
      const result = await provider.sendTransaction({
        transaction: txJson,
        feePayer: {
          fee: 1e10,
        },
      })

      console.log(result)
      setTxResult(result)
      return result
    } catch (e: any) {
      console.error(`Error in SpecSettlement: ${e}`)
      setError(e.message || 'Transaction failed')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const getExplorerUrl = (hash: string) => {
    return `https://minascan.io/devnet/tx/${hash}?type=zk-tx`
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-2xl mx-auto">
      <button
        onClick={handleSettlement}
        disabled={!provider || !proofJson || isLoading || walletError !== null}
        className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-500 disabled:opacity-50 transition-colors"
      >
        {isLoading ? 'Settling...' : 'Settle Zkapp'}
      </button>

      {!provider && (
        <p className="text-sm text-gray-400">Waiting for Mina provider...</p>
      )}
      {walletError && (
        <p className="text-sm text-gray-400">{walletError}</p>
      )}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-red-300 text-sm">
            <span className="font-semibold">Error:</span> {error}
          </p>
        </div>
      )}

      {txResult && (
        <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg w-full">
          <h3 className="text-green-300 font-semibold mb-2">
            Transaction Submitted!
          </h3>
          <div className="space-y-2">
            <div className="break-all">
              <span className="text-gray-400 text-sm">Hash:</span>
              <p className="text-white font-mono text-sm">
                {txResult.hash || txResult.txId}
              </p>
            </div>
            {(txResult.hash || txResult.txId) && (
              <a
                href={getExplorerUrl(txResult.hash || txResult.txId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 text-sm underline"
              >
                View on Explorer - Upon included tx, you can refresh and see the
                counter is incremented!
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
