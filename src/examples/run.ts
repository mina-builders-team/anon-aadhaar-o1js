import { Bytes, verify } from 'o1js';
import { SignatureVerifier } from '../signatureVerifier.js';
import { BLOCK_SIZES } from '../utils.js';

import { getQRData, TEST_DATA } from '../getQRData.js';

const { paddedData, initialValue, signatureBigint, publicKeyBigint } =
  getQRData(TEST_DATA);

let proofsEnabled = true;

console.time('Compile');
const { verificationKey } = await SignatureVerifier.compile({ proofsEnabled });
console.timeEnd('Compile');

// Now split at your desired boundaries (Should be a multiple of 64 bytes).
const pad1 = Bytes.from(paddedData.toBytes().slice(0, BLOCK_SIZES.MEDIUM));

const pad2 = Bytes.from(
  paddedData.toBytes().slice(BLOCK_SIZES.MEDIUM, BLOCK_SIZES.LARGE)
);

const pad3 = Bytes.from(paddedData.toBytes().slice(BLOCK_SIZES.LARGE));

// Generate proofs step by step
console.time('Proof generations');
const proof1 = await SignatureVerifier.baseCase512(pad1, initialValue);
const proof2 = await SignatureVerifier.hashStep512(proof1.proof, pad2);
const proof3 = await SignatureVerifier.hashStep128(proof2.proof, pad3);

// Now you can verify the RSA65537 signature. Should throw an error if verification fails.
const { proof } = await SignatureVerifier.verifySignature(
  proof3.proof,
  signatureBigint,
  publicKeyBigint
);
console.timeEnd('Proof generations');

console.time('Verification');
await verify(proof, verificationKey);
console.timeEnd('Verification');
