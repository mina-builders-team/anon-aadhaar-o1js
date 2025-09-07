import { PresentationRequestType, StoredCredential } from "mina-attestations";


export interface SignedData {
  publicKey: string;
  data: string;
  signature: string;
}

export interface ProviderError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

export type ChainInfoArgs = {
  networkID: string;
};

export type IStoreCredentialData = {
    credential: string;
};

export type PresentationRequest<
    InputContext = any,
> = {
    type: PresentationRequestType;
    spec: any;
    claims: any;
    inputContext: InputContext;
    program?: unknown;
    verificationKey?: unknown;
};

export type IPresentationRequest = {
    presentationRequest:PresentationRequest
    zkAppAccount?:any
}

export type PresentationArgs = {
    presentation:IPresentationRequest
}

export type IRequestPresentation = {
    presentation: string;
};

type StoredCredentialArgs = {
    credential:StoredCredential
}

export interface MinaWallet {
  requestAccounts: () => Promise<string[] | ProviderError>;
  signFields: (args: {
    message: Array<string | number>;
  }) => Promise<SignedData | ProviderError>;
  on: (event: string, handler: Function) => void;
  switchChain: (args: ChainInfoArgs) => Promise<ChainInfoArgs | ProviderError>;
  requestNetwork: () => Promise<ChainInfoArgs>;
  getAccounts: () => Promise<string[]>;
  storePrivateCredential(args: StoredCredentialArgs): Promise<IStoreCredentialData | ProviderError>;  
  requestPresentation(args: PresentationArgs): Promise<IRequestPresentation | ProviderError>;
};

