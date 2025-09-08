'use client';
import { MinaWallet } from "@/worker_utils/walletTypes";
import { ageMoreThan18Spec } from "anon-aadhaar-o1js";
import { Presentation, PresentationRequest, StoredCredential } from "mina-attestations";
import { PresentationRequestSchema } from "mina-attestations/validation";
import { Field, NetworkId, PublicKey } from "o1js";



  const getCredentialRequirements = (presentationRequest: any) => {
    const extractDataFields = (data: any) => {
      if (!data) return [];

      if (data._type === "Struct" && data.properties) {
        return Object.keys(data.properties);
      }

      if (data._type === "DynamicRecord" && data.knownShape) {
        return Object.keys(data.knownShape);
      }
      return Object.keys(data);
    };
    const requirements = [];
    for (const [key, input] of Object.entries(
      presentationRequest.spec.inputs
    ) as any) {
      if (input.type === "credential" && input.credentialType && input.data) {
        requirements.push({
          inputKey: key,
          type: input.credentialType,
          dataFields: extractDataFields(input.data),
        });
      }
    }
    return requirements;
  };



export default function SpecSettlement({credentialJson, zkAppPublicKey}: Props){
    const handleSettlement = async () => {
      try {

        await window.mina?.requestAccounts();
        if (!credentialJson) throw new Error("No valid credential is provided!");

        const credential: StoredCredential = JSON.parse(credentialJson);

        if(!credential){
          throw new Error('Error on SpecSettlement - No credential found')
        };
        
        const stored = await window.mina?.storePrivateCredential({
          credential: credential
        }).catch((err: any) => err);

        console.log(stored);

        const presentation = await requestPresentation(zkAppPublicKey.toBase58()).catch((err: any) => err);

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

async function requestPresentation(zkAppAddress: string){

  const zkAppPublicKey = PublicKey.fromBase58(zkAppAddress);

  const spec = await ageMoreThan18Spec();

  const precompiled = await Presentation.precompile(spec);

  const now = new Date();
  const currentDay = Field.from(now.getUTCDate());
  const currentMonth = Field.from(now.getUTCMonth() + 1);
  const currentYear = Field.from(now.getUTCFullYear());

  const request = PresentationRequest.zkAppFromCompiled(
    precompiled,
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

  const req = getCredentialRequirements(request);
  console.log(req);

  console.log("presentation request will be sent!");
  
  const presentation = await window.mina?.requestPresentation({
    presentation:{
      presentationRequest: JSON.parse(reqJson),
      zkAppAccount:zkAppAddress
    }
  }).catch((err: any) => err);

  if(!presentation) {
    throw new Error('Error the get presentation request from wallet');
  }
  console.log("presentation request is sent, here is the presentation: ");
  
  console.log(presentation);

  return presentation;
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