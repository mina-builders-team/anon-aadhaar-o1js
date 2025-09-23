'use client';
import { useWorkerStore } from "@/stores/workerStore";
import { useMinaProvider } from "@/context/MinaProviderContext";
import { Mina, Transaction } from 'o1js';
import { MINA_ARCHIVE_ENDPOINT, MINA_NODE_ENDPOINT } from 'anon-aadhaar-o1js';

type Props = {
    proofJson: string,
    zkAppPublicKey: string,
}

export default function SpecSettlement({proofJson, zkAppPublicKey}: Props){
    const { settleProof } = useWorkerStore(); // Updated method name
    const { provider } = useMinaProvider();

    const handleSettlement = async () => {
        try {
            if (!proofJson) throw new Error("No valid proof is found!");
            if (!provider) throw new Error("Mina provider not available!");
            
            const proof = JSON.parse(proofJson);
            if(!proof){
                throw new Error('Error on SpecSettlement - No credential found');
            }

            // Get accounts from provider
            const accounts = await provider.getAccounts();
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found');
            }

            const senderAddress = accounts[0];
            
            // Prepare transaction in worker (heavy computation)
            console.log('Preparing settlement transaction...');
            const txJson = await settleProof(proofJson, zkAppPublicKey, senderAddress);
            
            if (!txJson) {
                throw new Error('Failed to prepare transaction');
            }

            // Set up network in main thread for sending
            const network = Mina.Network({
                mina: MINA_NODE_ENDPOINT,
                archive: MINA_ARCHIVE_ENDPOINT
            });
            Mina.setActiveInstance(network);
            
            // Send transaction using the provider (wallet interaction)
            console.log('Sending transaction...');
            const txResult = await provider.sendTransaction(
              {
                  transaction: txJson,
                  feePayer:{
                    fee: 1e9
                  }
              }
            )
            console.log(txResult)

            return !!txResult;
        } catch (e: any) {
            console.error(`Error in SpecSettlement: ${e}`);
            console.log(e);
            return false;
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 p-6 max-w-2xl mx-auto">
            <button 
                onClick={handleSettlement}
                disabled={!provider || !proofJson}
                className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
                Settle Zkapp
            </button>
            {!provider && (
                <p className="text-sm text-gray-400">Waiting for Mina provider...</p>
            )}
        </div>
    );
}
