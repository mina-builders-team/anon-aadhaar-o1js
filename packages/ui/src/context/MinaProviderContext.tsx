'use client'
import { IMinaProvider } from '@aurowallet/mina-provider/dist/IProvider'
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'

// Define the context shape
interface MinaProviderContextType {
  provider: IMinaProvider | null
  walletError: string | null
  setProvider: (provider: IMinaProvider | null) => void
  disconnectProvider: () => void
  connectWallet: () => void
  syncMinaChain: () => void
}

// Create the context with an undefined default
const MinaProviderContext = createContext<MinaProviderContextType | undefined>(
  undefined
)

// Define the custom event type for mina:announceProvider
interface MinaAnnounceProviderEvent extends Event {
  detail?: {
    info?: { slug: string }
    provider?: IMinaProvider & { isAuro?: boolean }
  }
}

// Provider component
export const AuroMinaProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [provider, setProvider] = useState<IMinaProvider | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)

  // Initialize the provider using mina:announceProvider event
  useEffect(() => {
    const handleAnnounceProvider = async (event: MinaAnnounceProviderEvent) => {
      if (!provider) {
        if (
          event?.detail?.info?.slug === 'aurowallet' ||
          event?.detail?.provider?.isAuro
        ) {
          const newProvider = event?.detail?.provider
          if (newProvider) {
            try {
              // Request accounts to ensure the wallet is connected
              const accounts = await newProvider.requestAccounts()
              setProvider(newProvider)
              console.log('Mina provider initialized:', accounts)
            } catch (error) {
              console.error('Failed to initialize Mina provider:', error)
            }
          }
        }
      }
    }

    window.addEventListener(
      'mina:announceProvider',
      handleAnnounceProvider as EventListener
    )

    return () => {
      window.removeEventListener(
        'mina:announceProvider',
        handleAnnounceProvider as EventListener
      )
    }
  }, [provider])

  // Handle account changes
  useEffect(() => {
    console.log('Provider changed:', provider)

    if (provider) {
      console.log('Provider changed=1:')
      const checkChain = async () => {
        await syncMinaChain()
      }
      checkChain()
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('outer Accounts changed:', accounts)
        // Optionally update state or re-initialize provider
      }

      provider.on('accountsChanged', handleAccountsChanged)
      provider.on('chainChanged', syncMinaChain)

      return () => {
        provider.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [provider])

  const connectWallet = () => {
    // Ask Auro wallet to announce itself
    window.dispatchEvent(new Event('mina:requestProvider'))
  }

  const syncMinaChain = async () => {
    const currentMinaNetworkId = await provider
      ?.requestNetwork()
      .catch((err: any) => err)
    console.log(currentMinaNetworkId, provider)
    const isOnValidChain = currentMinaNetworkId?.networkID === 'mina:devnet'
    if (!isOnValidChain) {
      const switchResult = await provider
        ?.switchChain({
          networkID: 'mina:devnet',
        })
        .catch((err: any) => err)
      if (switchResult?.networkID) {
        setWalletError(null)
      } else {
        setWalletError('Please switch your wallet to the Devnet network.')
      }
    } else {
      setWalletError(null)
    }
    return isOnValidChain
  }
  // Disconnect provider
  const disconnectProvider = () => {
    setProvider(null)
    console.log('Provider disconnected')
  }

  return (
    <MinaProviderContext.Provider
      value={{
        provider,
        walletError,
        setProvider,
        disconnectProvider,
        connectWallet,
        syncMinaChain
      }}
    >
      {children}
    </MinaProviderContext.Provider>
  )
}

// Custom hook to access the provider
export const useMinaProvider = (): MinaProviderContextType => {
  const context = useContext(MinaProviderContext)
  if (!context) {
    throw new Error('useMinaProvider must be used within a AuroMinaProvider')
  }
  return context
}
