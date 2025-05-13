import { verify } from 'o1js';
import { SignatureVerifier } from '../signatureVerifier.js';

import { getQRData, TEST_DATA } from '../getQRData.js';
import { compute512BasedHash } from '../testUtils.js';
import { RecursiveHash } from '../recursiveHash.js';

const { paddedData, initialValue, signatureBigint, publicKeyBigint } =
  getQRData(TEST_DATA);

let proofsEnabled = true;

console.time('Compile Hash Circuit');
await RecursiveHash.compile({ proofsEnabled });
console.timeEnd('Compile Hash Circuit');

console.time('Compile Verifier Circuit');
const { verificationKey } = await SignatureVerifier.compile({ proofsEnabled });
console.timeEnd('Compile Verifier Circuit');

console.time('Proof generations');

const finalProof = await compute512BasedHash(paddedData, initialValue);

console.timeEnd('Proof generations');
// Now you can verify the RSA65537 signature. Should throw an error if verification fails.

console.time('Signature verification');
const { proof } = await SignatureVerifier.verifySignature(
  finalProof,
  signatureBigint,
  publicKeyBigint
);
console.timeEnd('Signature verification');

console.time('Verification');
await verify(proof, verificationKey);
console.timeEnd('Verification');
