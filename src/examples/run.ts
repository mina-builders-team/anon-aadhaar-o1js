import { Bytes32 } from '../dataTypes.js';
import { SignatureVerifier } from '../signatureVerifier.js';

import { getQRData, TEST_DATA } from '../getQRData.js';
import { prepareRecursiveHashData } from '../testUtils.js';
import {
  hashProgram,
  hashWrapper,
  recursiveHashProgram,
} from '../recursion.js';


const { signatureBigint, publicKeyBigint, signedData } = getQRData(TEST_DATA);

let proofsEnabled = false;

console.time('Compile Hash Circuit');
await hashProgram.compile({ proofsEnabled });
await recursiveHashProgram.compile({ proofsEnabled });
await hashWrapper.compile({ proofsEnabled });
console.timeEnd('Compile Hash Circuit');

console.time('Compile Verifier Circuit');
const { verificationKey } = await SignatureVerifier.compile({ proofsEnabled });
console.timeEnd('Compile Verifier Circuit');

console.time('Proof generations');
const preparedData = prepareRecursiveHashData(signedData);
const finalProof = await hashWrapper.run(preparedData);
const finalHash = Bytes32.from(
  finalProof.proof.publicOutput.array.flatMap((x) => x.toBytesBE())
);

console.log(finalHash.toHex());
console.timeEnd('Proof generations');
// // Now you can verify the RSA65537 signature. Should throw an error if verification fails.

console.time('Signature verification');

const { proof } = await SignatureVerifier.verifySignature(
  finalProof.proof,
  signatureBigint,
  publicKeyBigint
);
console.timeEnd('Signature verification');

// Commented out for now due to a low level error: Bin_prot.Common.Buffer_short
// console.time('Verification');
// await verify(proof, verificationKey);
// console.timeEnd('Verification');
