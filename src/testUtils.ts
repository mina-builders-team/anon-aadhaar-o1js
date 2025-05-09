import { Bytes, UInt32 } from 'o1js';
import { BLOCK_SIZES } from './utils.js';
import { RecursiveHash } from './recursiveHash.js';
export { computed512BasedHash, computeChained128Hash };

async function computed512BasedHash(paddedData: Bytes, initialValue: UInt32[]) {
  const byteData = paddedData.toBytes();

  const pad1 = Bytes.from(byteData.slice(0, BLOCK_SIZES.MEDIUM));

  const pad2 = Bytes.from(
    byteData.slice(BLOCK_SIZES.MEDIUM, BLOCK_SIZES.LARGE)
  );
  const pad3 = Bytes.from(byteData.slice(BLOCK_SIZES.LARGE));

  const proof1 = await RecursiveHash.baseCase512(pad1, initialValue);
  const proof2 = await RecursiveHash.hashStep512(proof1.proof, pad2);
  const finalProof = await RecursiveHash.hashStep128(proof2.proof, pad3);

  const result3 = finalProof.proof.publicOutput;

  // Get final digest
  const finalDigest = Bytes.from(
    result3.hashState.flatMap((w: UInt32) => w.toBytesBE())
  );

  return [finalProof,finalDigest];
}

async function computeChained128Hash(
  paddedData: Bytes,
  initialValue: UInt32[]
) {
  const paddedDataChunks = [];
  for (let i = 0; i < 9; i++) {
    paddedDataChunks[i] = Bytes.from(
      paddedData
        .toBytes()
        .slice(i * BLOCK_SIZES.SMALL, BLOCK_SIZES.SMALL * (i + 1))
    );
  }
  // Compute proofs recursively
  const proof1 = await RecursiveHash.baseCase128(
    paddedDataChunks[0],
    initialValue
  );
  const proof2 = await RecursiveHash.hashStep128(
    proof1.proof,
    paddedDataChunks[1]
  );
  const proof3 = await RecursiveHash.hashStep128(
    proof2.proof,
    paddedDataChunks[2]
  );
  const proof4 = await RecursiveHash.hashStep128(
    proof3.proof,
    paddedDataChunks[3]
  );
  const proof5 = await RecursiveHash.hashStep128(
    proof4.proof,
    paddedDataChunks[4]
  );
  const proof6 = await RecursiveHash.hashStep128(
    proof5.proof,
    paddedDataChunks[5]
  );
  const proof7 = await RecursiveHash.hashStep128(
    proof6.proof,
    paddedDataChunks[6]
  );
  const proof8 = await RecursiveHash.hashStep128(
    proof7.proof,
    paddedDataChunks[7]
  );
  const finalProof = await RecursiveHash.hashStep128(
    proof8.proof,
    paddedDataChunks[8]
  );

  const result = finalProof.proof.publicOutput;

  // Get final digest
  const finalDigest = Bytes.from(
    result.hashState.flatMap((w: UInt32) => w.toBytesBE())
  );

  return [finalProof,finalDigest];
}
