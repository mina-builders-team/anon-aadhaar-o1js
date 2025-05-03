import { SignatureVerifier } from './signatureVerifier.js';
import { Bytes, Gadgets, UInt32 } from 'o1js';
import { Bigint2048 } from './rsa.js';

import { BLOCK_SIZES } from './utils.js';
import { getQRData } from './getQRData.js';

const proofsEnabled = false;

describe('Signature Verifier', () => {
  let initialValue: UInt32[];
  let paddedData: Bytes;

  let publicKeyBigint: Bigint2048;
  let signatureBigint: Bigint2048;
  let signedData: Uint8Array;

  beforeAll(async () => {
    await SignatureVerifier.compile({ proofsEnabled });

    const inputs = getQRData();

    publicKeyBigint = inputs.publicKeyBigint;
    signatureBigint = inputs.signatureBigint;
    paddedData = inputs.paddedData;
    initialValue = inputs.initialValue;
    signedData = inputs.signedData;
  });

  describe('Partial hashing computations', () => {
    //
    // Warning: This step is used for testing 128-byte hashing. When set proofsEnabled = true, it
    //
    (!proofsEnabled ? it.skip : it)(
      'should compute partial hashing with 9 byte blocks of size 128 bytes.',
      async () => {
        // Now split at your desired boundaries (multiple of 64 bytes)
        const paddedDataChunks = [];
        for (let i = 0; i < 9; i++) {
          paddedDataChunks[i] = Bytes.from(
            paddedData
              .toBytes()
              .slice(i * BLOCK_SIZES.SMALL, BLOCK_SIZES.SMALL * (i + 1))
          );
        }
        // Compute proofs recursively
        const proof1 = await SignatureVerifier.baseCase128(
          paddedDataChunks[0],
          initialValue
        );
        const proof2 = await SignatureVerifier.hashStep128(
          proof1.proof,
          paddedDataChunks[1]
        );
        const proof3 = await SignatureVerifier.hashStep128(
          proof2.proof,
          paddedDataChunks[2]
        );
        const proof4 = await SignatureVerifier.hashStep128(
          proof3.proof,
          paddedDataChunks[3]
        );
        const proof5 = await SignatureVerifier.hashStep128(
          proof4.proof,
          paddedDataChunks[4]
        );
        const proof6 = await SignatureVerifier.hashStep128(
          proof5.proof,
          paddedDataChunks[5]
        );
        const proof7 = await SignatureVerifier.hashStep128(
          proof6.proof,
          paddedDataChunks[6]
        );
        const proof8 = await SignatureVerifier.hashStep128(
          proof7.proof,
          paddedDataChunks[7]
        );
        const proof9 = await SignatureVerifier.hashStep128(
          proof8.proof,
          paddedDataChunks[8]
        );

        const result = proof9.proof.publicOutput;

        // Get final digest
        const finalDigest = Bytes.from(
          result.hashState.flatMap((w: UInt32) => w.toBytesBE())
        );

        const expectedDigest = Gadgets.SHA2.hash(256, signedData);
        expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
      }
    );

    it('should compute partial hashing with byte blocks split by 512-512-128.', async () => {
      // Pad the blocks for SHA256 processes. Padding of the internal SHA256 function will be used here.
      const paddedBlocks = Gadgets.SHA2.padding(256, signedData);

      // Process these blocks in chunks if needed
      const initialValue: UInt32[] = Gadgets.SHA2.initialState(256);

      // If you want to split at specific byte boundaries, first convert blocks to bytes
      let paddedData = Bytes.from(
        paddedBlocks
          .flat()
          .map((word) => word.toBytesBE())
          .flat()
      );

      // Now split at your desired boundaries (multiple of 64 bytes)
      const pad1 = Bytes.from(
        paddedData.toBytes().slice(0, BLOCK_SIZES.MEDIUM)
      );
      const pad2 = Bytes.from(
        paddedData.toBytes().slice(BLOCK_SIZES.MEDIUM, BLOCK_SIZES.LARGE)
      );
      const pad3 = Bytes.from(paddedData.toBytes().slice(BLOCK_SIZES.LARGE));

      const proof1 = await SignatureVerifier.baseCase512(pad1, initialValue);
      const proof2 = await SignatureVerifier.hashStep512(proof1.proof, pad2);
      const proof3 = await SignatureVerifier.hashStep128(proof2.proof, pad3);

      const result3 = proof3.proof.publicOutput;

      // Get final digest
      const finalDigest = Bytes.from(
        result3.hashState.flatMap((w: UInt32) => w.toBytesBE())
      );

      const expectedDigest = Gadgets.SHA2.hash(256, signedData);
      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    });
  });

  describe('Signature verification computations', () => {
    it('should verify rsa signature correctly', async () => {
      // Pad the blocks for SHA256 processes. Padding of the internla SHA256 function will be used here.
      const paddedBlocks = Gadgets.SHA2.padding(256, signedData);

      // Process these blocks in chunks if needed
      const initialValue: UInt32[] = Gadgets.SHA2.initialState(256);

      // If you want to split at specific byte boundaries, first convert blocks to bytes
      let paddedData = Bytes.from(
        paddedBlocks
          .flat()
          .map((word) => word.toBytesBE())
          .flat()
      );

      // Now split at your desired boundaries (multiple of 64 bytes)
      const pad1 = Bytes.from(
        paddedData.toBytes().slice(0, BLOCK_SIZES.MEDIUM)
      );

      const pad2 = Bytes.from(
        paddedData.toBytes().slice(BLOCK_SIZES.MEDIUM, BLOCK_SIZES.LARGE)
      );

      const pad3 = Bytes.from(paddedData.toBytes().slice(BLOCK_SIZES.LARGE));

      const proof1 = await SignatureVerifier.baseCase512(pad1, initialValue);
      const proof2 = await SignatureVerifier.hashStep512(proof1.proof, pad2);
      const proof3 = await SignatureVerifier.hashStep128(proof2.proof, pad3);

      // Should throw an error if verification fails.
      const { proof } = await SignatureVerifier.verifySignature(
        proof3.proof,
        signatureBigint,
        publicKeyBigint
      );
    });
    it('should reject verification with tampered signature', async () => {});
  });
});
