
import { Bytes, Field, Int64, PrivateKey, Provable, UInt64 } from 'o1js';
import {
  Spec,
  Operation,
  Claim,
  Credential,
  Presentation,
  PresentationRequest,
  assert,
  DynamicString,
} from 'mina-attestations';
import { AadhaarOutputs, AadhaarVerifierProof } from './AadhaarVerifier';

const String = DynamicString({ maxLength: 50 });

export const AadharCredential = await Credential.Imported.fromMethod(
    {
        name: 'aadhar-credential',
        publicInput: { issuer: Field },
        privateInput: { 
            aadharVerifierProof: AadhaarVerifierProof,
        },
        data: AadhaarOutputs,
    },
    async ({ privateInput }: { privateInput: { aadharVerifierProof: AadhaarVerifierProof } }) => {
        Provable.asProver(() => {
            Provable.log("AadharCredential" ,privateInput.aadharVerifierProof.publicOutput.toString());
        });
        privateInput.aadharVerifierProof.verify();
        privateInput.aadharVerifierProof.publicOutput.Timestamp.assertGreaterThan(0);
      return privateInput.aadharVerifierProof.publicOutput;
    }
);