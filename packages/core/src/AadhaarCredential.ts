
import { Credential } from 'mina-attestations';
import { AadhaarOutputs, AadhaarVerifierProof } from './AadhaarVerifier.js';


export async function AadhaarCredentialFactory() {
    return await Credential.Imported.fromMethod(
        {
            name: 'aadhaar-credential',
            publicInput: {},
            privateInput: { 
                aadhaarVerifierProof: AadhaarVerifierProof,
            },
            data: AadhaarOutputs,
        },
        async ({ privateInput }: { privateInput: { aadhaarVerifierProof: AadhaarVerifierProof } }) => {
            privateInput.aadhaarVerifierProof.verify();
            privateInput.aadhaarVerifierProof.publicOutput.Timestamp.assertGreaterThan(0);
            return privateInput.aadhaarVerifierProof.publicOutput;
        }
    )
}