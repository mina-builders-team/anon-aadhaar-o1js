import { useMinaProvider } from '@/context/MinaProviderContext';
import { fetchHashCacheFiles, fetchVerifierCacheFiles, fetchZkappCacheFiles, MinaFileSystem } from '@/worker_utils/utils';
import { AadhaarVerifier, AadhaarVerifierProof, CounterZkapp, createPaddedQRData, getQRData, hashProgram, MINA_ARCHIVE_ENDPOINT, MINA_NODE_ENDPOINT, prepareRecursiveHashData } from 'anon-aadhaar-o1js'
import * as Comlink from 'comlink'
import { Cache, fetchAccount, Field, JsonProof, Mina, PublicKey } from 'o1js'

let isInitialized = false

let zkAppInstance: CounterZkapp;

async function init(zkAppPublicKey : string){
    try{ 
        
    console.log('Compiling Counter zkapp...');
    let hashCacheFiles = await fetchHashCacheFiles();
    let verifierCacheFiles = await fetchVerifierCacheFiles();
    let zkappCacheFiles = await fetchZkappCacheFiles();

    let hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    let verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;
    let zkappCache = MinaFileSystem(zkappCacheFiles) as Cache;

    await hashProgram.compile({cache: hashCache});
    await AadhaarVerifier.compile({cache: verifierCache});
    const { verificationKey } = await CounterZkapp.compile({cache: zkappCache});
    console.log('Compiled Counter zkapp...');    
    const zkAppAddress = PublicKey.fromBase58(zkAppPublicKey);

    zkAppInstance = new CounterZkapp(zkAppAddress);

    isInitialized = true;

    return verificationKey;
} catch (e) {
    console.error('Error occured: ', e)
  }
}

async function settleProof(proofJson: string, zkAppPubKey: string, senderAddress: string): Promise<any> {
    if (!isInitialized) {
        console.error('Worker is not initialized. Please call init() first')
        return null;
    }

    try {
        const aadhaarProof = await AadhaarVerifierProof.fromJSON(JSON.parse(proofJson));
        const sender = PublicKey.fromBase58(senderAddress);
        
        const network = Mina.Network({
            mina: MINA_NODE_ENDPOINT,
            archive: MINA_ARCHIVE_ENDPOINT
        });

        const zkAppAddress = PublicKey.fromBase58(zkAppPubKey);
        
        Mina.setActiveInstance(network);
        await fetchAccount({publicKey: zkAppAddress});

        console.log('Value in the counter: ', zkAppInstance.counter.get())

        const settlementTx = await Mina.transaction({sender: sender, fee:1e9}, async () => {
            await zkAppInstance.verifyAadhaar(aadhaarProof);
        });

        // Prove the transaction in the worker (this is computationally intensive)
        await settlementTx.prove();
        
        // Return the proved transaction JSON to be sent in React context
        return settlementTx.toJSON();
    }
    catch (error: unknown) {
        console.error('Error preparing settlement transaction:', error);
        return null;
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

async function extract(
  verifierProofString: string,
  qrNumericString: string,
  publicKeyHex: string
): Promise<string | null> {
  if (!isInitialized) {
    console.log(
      'Extractor worker seems to be not initialized. Please call init() first!'
    )
    return null
  }
  try {
    console.log('Executing Extraction Method')
    const vp: JsonProof = JSON.parse(verifierProofString)
    const verifierProof = await AadhaarVerifierProof.fromJSON(vp)
    const inputs = getQRData(qrNumericString, publicKeyHex)
    const paddedData = inputs.paddedData.toBytes()

    const data = createPaddedQRData(paddedData).map(Field)

    console.time('extractor')
    const { proof } = await AadhaarVerifier.extractor(verifierProof, data)
    console.timeEnd('extractor')
    const proofString = JSON.stringify(proof.toJSON())

    console.log('Extractor proof ready')
    return proofString
  } catch (error: unknown) {
    console.log('Extraction failed!', error)
    return null
  }
}



const api = {
    init,
    settleProof
}

export type ZkappWorkerAPI = typeof api;
Comlink.expose(api);