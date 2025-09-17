import * as Comlink from 'comlink'
import {
  Credential,
  Presentation,
  PresentationRequest,
} from 'mina-attestations'
import { PrivateKey } from 'o1js'

async function createPresentation(
  requestJson: string,
  credentialJson: string,
  ownerPrivateKeyBase58: string
) {
  // Deserialize request
  const request = PresentationRequest.fromJSON('https', requestJson)
  // Compile request into spec for creation
  const compiled = await Presentation.compile(request)
  // Load credential
  const credential = await Credential.fromJSON(credentialJson)
  // Rebuild owner key
  const ownerKey = PrivateKey.fromBase58(ownerPrivateKeyBase58)
  // Create presentation
  const presentation = await Presentation.create(ownerKey, {
    request: compiled,
    credentials: [{ ...credential, key: 'credential' }],
    context: { verifierIdentity: 'anon-aadhaar-o1js.demo' },
  })
  return Presentation.toJSON(presentation)
}

const api = { createPresentation }
export type PresentationWorkerAPI = typeof api
Comlink.expose(api)
