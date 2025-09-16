'use client';
import { useMinaProvider } from "@/context/MinaProviderContext";
import { MinaWallet, IStoreCredentialData } from "@/worker_utils/walletTypes";
import { ageMoreThan18Spec } from "anon-aadhaar-o1js";
import { PresentationRequest, } from "mina-attestations";
import { Field, PublicKey } from "o1js";

export const SpecSettlement = ({credentialJson, zkAppPublicKey}: Props) => {
    const { provider } = useMinaProvider();

    const handleSettlement = async () => {
      try {
        if (!credentialJson) throw new Error("No valid credential is provided!");

        const credential = JSON.parse(credentialJson);
        console.log(credentialJson);

        if(!credential){
          throw new Error('Error on SpecSettlement - No credential found')
        };
        
        const stored: IStoreCredentialData = await provider?.storePrivateCredential({credential: {
          version: credential.version,
          credential: credential.credential,
          witness: credential.witness,
          metadata: credential.metadata
        },

      }).catch((err: any) => err);

        const spec = await ageMoreThan18Spec();

        const now = new Date();
        const currentDay = Field.from(now.getUTCDate());
        const currentMonth = Field.from(now.getUTCMonth() + 1);
        const currentYear = Field.from(now.getUTCFullYear());

        const request = PresentationRequest.zkApp(
          spec,
          {
            currentDay,
            currentMonth,
            currentYear,
          },
          {
          publicKey: zkAppPublicKey,
          methodName:'verifyAadhaar',
          network: 'devnet'
          }
        );

        const reqJson = PresentationRequest.toJSON(request);

        console.log("presentation request will be sent!");

        const presReq = JSON.parse(reqJson);

        console.log(reqJson);

        const presentation = await provider?.requestPresentation({
          presentation:{
            presentationRequest: presReq,
            zkAppAccount:zkAppPublicKey.toBase58()
          },
        }).catch((err: any) => err);

        if(!presentation) {
          throw new Error('Error the get presentation request from wallet');
        }
        console.log("presentation request is sent, here is the presentation: ");
        
        console.log(presentation);

        console.log("Presentation from wallet", presentation);
      } catch (e: any) {
        console.error(`Error in SpecSettlement: ${e}`);
        console.log(e)
       
      }
    };

    return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-2xl mx-auto">
      <button onClick={handleSettlement}
        className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-500 disabled:opacity-50 transition-colors"
      >
        Settle Zkapp
      </button>
    </div>
  );
}
type Props = {
    credentialJson?: string,
    zkAppPublicKey: PublicKey,
}

declare global {
  interface Window {
    mina?: MinaWallet;
  }
}