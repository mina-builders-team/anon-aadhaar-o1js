import { SignatureVerifier } from '../signatureVerifier.js';

import { getQRData, TEST_DATA } from '../getQRData.js';
import { prepareRecursiveHashData } from '../testUtils.js';
import { hashProgram } from '../recursion.js';
import { verify } from 'o1js';

const { signatureBigint, publicKeyBigint, signedData } = getQRData(TEST_DATA);

let proofsEnabled = true;

console.time('Compile Hash Circuit');
await hashProgram.compile({ proofsEnabled });
console.timeEnd('Compile Hash Circuit');

console.time('Compile Verifier Circuit');
const { verificationKey } = await SignatureVerifier.compile({ proofsEnabled });
console.timeEnd('Compile Verifier Circuit');

const preparedData = prepareRecursiveHashData(signedData);

// Now you can verify the RSA65537 signature. Should throw an error if verification fails.
console.time('Signature verification');

const { proof } = await SignatureVerifier.verifySignature(
  preparedData,
  signatureBigint,
  publicKeyBigint
);
console.timeEnd('Signature verification');

// When proofsEnabled:false, it throws an error. Problem solved, Yay!
console.time('Verification');
await verify(proof, verificationKey);
console.timeEnd('Verification');
