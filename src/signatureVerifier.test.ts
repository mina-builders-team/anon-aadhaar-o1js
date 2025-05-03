import { SignatureVerifier } from './signatureVerifier.js';
import { Bytes, Gadgets, UInt32 } from 'o1js';
import { Bigint2048 } from './rsa.js';

import { BLOCK_SIZES } from './utils.js';
import { getQRData } from './getQRData.js';
import { sign } from 'o1js/dist/node/mina-signer/src/signature.js';

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

    it('should reject verification with tampered signature', async () => {

      const wrongSignature = signatureBigint.modSquare(publicKeyBigint);
        
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
      await expect(async () => {
        await SignatureVerifier.verifySignature(
          proof3.proof,
          wrongSignature,
          publicKeyBigint
        )
      }).rejects.toThrow('Field.assertEquals(): 9188579551671412591472664553230141 != 40899547542153145199703733613250199');
    });
    it.only('should reject verification with wrong public key', async () => {

      // A completely different & weird value
      const wrongPublicKeyHex = "94e81f7506595cc262addcfddd35d704055b2adf46dc619c56b48eee199995eca1a3254710620ac7801e976f44e3be454db0f190e3f7d4e3598972117344de52fcf7826f849488a959a7b3d21eb6dd03451662ea883eeeefde889a1499b9a47f9504c5f096c262b96d23d19750332d9e97eb6141d261de97994d4c4163ca9cbe3e077221b44253dcf81609428b68351ee3e9b60d2b351fdaa6ee8c28a845239f97de7cc0fe5d144e474813fb43ec583f81b4ee328c22167334898d210ba017a26ec68940f05df22bd9cc86bbc3a4354392372d566167769b735ba12ca3580f919c1bd8ba70c4c2ab0acf2b09bc2fae981f3c0295a6e1e9f248f50073094ffaf1";
      const wrongPublicKey = Bigint2048.from(BigInt('0x' + wrongPublicKeyHex));
        
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
      await expect(async () => {
        await SignatureVerifier.verifySignature(
          proof3.proof,
          signatureBigint,
          wrongPublicKey
        )
      }).rejects.toThrow();
    });
  });
});
