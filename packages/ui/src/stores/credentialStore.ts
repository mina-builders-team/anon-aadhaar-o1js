import { create, StateCreator } from 'zustand'
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware'

interface CredentialState {
  credentialJson?: string
  setCredentialJson: (json?: string) => void
  clearCredential: () => void
}

const SHOULD_PERSIST = process.env.NEXT_PUBLIC_PERSIST_CREDENTIAL
  ? Boolean(process.env.NEXT_PUBLIC_PERSIST_CREDENTIAL)
  : true

const creator: StateCreator<CredentialState> = (set) => ({
  credentialJson: undefined,
  setCredentialJson: (json?: string) => set({ credentialJson: json }),
  clearCredential: () => set({ credentialJson: undefined }),
})

export const useCredentialStore = SHOULD_PERSIST
  ? create<CredentialState>()(
      persist<CredentialState>(creator, {
        name: 'anon-aadhaar-credential',
        storage: createJSONStorage(() => localStorage),
        partialize: (state: CredentialState): Partial<CredentialState> => ({
          credentialJson: state.credentialJson,
        }),
      } as PersistOptions<CredentialState>)
    )
  : create<CredentialState>()(creator)
