import { fetchHashCacheFiles, fetchVerifierCacheFiles, fetchZkappCacheFiles, MinaFileSystem } from '@/worker_utils/utils';
import { AadhaarVerifier, AadhaarVerifierProof, CounterZkapp, hashProgram, MINA_ARCHIVE_ENDPOINT, MINA_NODE_ENDPOINT } from 'anon-aadhaar-o1js'
import * as Comlink from 'comlink'
import { Cache, fetchAccount, Mina, PublicKey } from 'o1js'

let isInitialized = false

let zkAppInstance: CounterZkapp;

async function init(zkAppPublicKey : string){
    try { 
        
    console.log('Compiling Counter zkapp...');
    const hashCacheFiles = await fetchHashCacheFiles();
    const verifierCacheFiles = await fetchVerifierCacheFiles();
    const zkappCacheFiles = await fetchZkappCacheFiles();

    const hashCache = MinaFileSystem(hashCacheFiles) as Cache;
    const verifierCache = MinaFileSystem(verifierCacheFiles) as Cache;
    const zkappCache = MinaFileSystem(zkappCacheFiles) as Cache;

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

const api = {
    init,
    settleProof
}

export type ZkappWorkerAPI = typeof api;
Comlink.expose(api);