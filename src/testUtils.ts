import { Bytes, UInt32 } from 'o1js';
import { SignatureVerifier } from './signatureVerifier.js';
import { BLOCK_SIZES } from './utils.js';
export { generateHashInThreeSteps };

async function generateHashInThreeSteps(
  paddedData: Bytes,
  initialValue: UInt32[]
) {
  const byteData = paddedData.toBytes();

  const pad1 = Bytes.from(byteData.slice(0, BLOCK_SIZES.MEDIUM));

  const pad2 = Bytes.from(
    byteData.slice(BLOCK_SIZES.MEDIUM, BLOCK_SIZES.LARGE)
  );
  const pad3 = Bytes.from(byteData.slice(BLOCK_SIZES.LARGE));

  const proof1 = await SignatureVerifier.baseCase512(pad1, initialValue);
  const proof2 = await SignatureVerifier.hashStep512(proof1.proof, pad2);
  const proof3 = await SignatureVerifier.hashStep128(proof2.proof, pad3);

  const result3 = proof3.proof.publicOutput;

  // Get final digest
  const finalDigest = Bytes.from(
    result3.hashState.flatMap((w: UInt32) => w.toBytesBE())
  );

  return finalDigest;
}
