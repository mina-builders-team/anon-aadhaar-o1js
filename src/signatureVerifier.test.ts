import { SignatureVerifier } from './signatureVerifier.js';

import { Gadgets } from 'o1js';
import { Bigint2048, rsaVerify65537 } from './rsa.js';

import { pkcs1v15Pad } from './utils.js';
import { getQRData, TEST_DATA, TEST_DATA_2 } from './getQRData.js';

import { pkcs1v15PadWrong, prepareRecursiveHashData } from './testUtils.js';

import { hashProgram, hashWrapper, recursiveHashProgram } from './recursion.js';

const proofsEnabled = false;

describe('Signature Verifier', () => {
  let publicKeyBigint: Bigint2048;
  let signatureBigint: Bigint2048;
  let signedData: Uint8Array;

  beforeAll(async () => {
    await hashProgram.compile({ proofsEnabled });
    await recursiveHashProgram.compile({ proofsEnabled });
    await hashWrapper.compile({ proofsEnabled });
    await SignatureVerifier.compile({ proofsEnabled });

    const inputs = getQRData(TEST_DATA);

    publicKeyBigint = inputs.publicKeyBigint;
    signatureBigint = inputs.signatureBigint;
    signedData = inputs.signedData;
  });

  describe('Signature verification computations', () => {
    it('should verify rsa signature correctly', async () => {
      const blocks = prepareRecursiveHashData(signedData);

      const { proof } = await hashWrapper.run(blocks);

      // Should throw an error if verification fails.
      await SignatureVerifier.verifySignature(
        proof,
        signatureBigint,
        publicKeyBigint
      );
    });

    it('should reject verification with tampered signature', async () => {
      const wrongSignature = signatureBigint.modSquare(publicKeyBigint);
      const blocks = prepareRecursiveHashData(signedData);

      const { proof } = await hashWrapper.run(blocks);

      const isVerified = async () => {
        await SignatureVerifier.verifySignature(
          proof,
          wrongSignature,
          publicKeyBigint
        );
      };

      await expect(isVerified).rejects.toThrow(
        'Field.assertEquals(): 9188579551671412591472664553230141 != 40899547542153145199703733613250199'
      );
    });
    it('should reject verification with wrong public key', async () => {
      // A completely different & weird value
      const wrongPublicKeyHex =
        '61e81f7506595cc262addcfddd35d704055b2adf46dc619c56b48eee199995eca1a3254710620ac7801e976f44e3be454db0f190e3f7d4e3598972117344de52fcf7826f849488a959a7b3d21eb6dd03451662ea883eeeefde889a1499b9a47f9504c5f096c262b96d23d19750332d9e97eb6141d261de97994d4c4163ca9cbe3e077221b44253dcf81609428b68351ee3e9b60d2b351fdaa6ee8c28a845239f97de7cc0fe5d144e474813fb43ec583f81b4ee328c22167334898d210ba017a26ec68940f05df22bd9cc86bbc3a4354392372d566167769b735ba12ca3580f919c1bd8ba70c4c2ab0acf2b09bc2fae981f3c0295a6e1e9f248f50073094ffaf1';
      const wrongPublicKey = Bigint2048.from(BigInt('0x' + wrongPublicKeyHex));

      const blocks = prepareRecursiveHashData(signedData);

      const { proof } = await hashWrapper.run(blocks);

      const isVerified = async () => {
        await SignatureVerifier.verifySignature(
          proof,
          signatureBigint,
          wrongPublicKey
        );
      };

      await expect(isVerified).rejects.toThrow(
        'Field.assertEquals(): 9188579551671412591472664553230141 != 19665786662882214150578387368928633'
      );
    });

    it('should reject verification with made-up data', async () => {
      // Change bytes with a random value. Make sure changed value is in the 8-bit range by applying mod (%) operation.
      const randomizedData = signedData.map(() =>
        Math.floor(Math.random() * 254)
      );

      // Now split at your desired boundaries (multiple of 64 bytes)
      // This test should fail especially for distorted padded bytes
      const blocks = prepareRecursiveHashData(randomizedData);

      const { proof } = await hashWrapper.run(blocks);

      const isVerified = async () => {
        await SignatureVerifier.verifySignature(
          proof,
          signatureBigint,
          publicKeyBigint
        );
      };
      await expect(isVerified).rejects.toThrow();
    });

    it('should reject verification when hash data lacks PKCS#1 v1.5 padding ', async () => {
      const digest = Gadgets.SHA2.hash(256, signedData);

      //Steps below are identical to the `verifySignature` method steps.

      const paddedHash = pkcs1v15Pad(digest);
      // First, try it with padded hash value.

      rsaVerify65537(paddedHash, signatureBigint, publicKeyBigint);

      // Now with non-padded hash.
      const nonPaddedHash = Bigint2048.from(BigInt('0x' + digest.toHex()));

      const isVerified = async () => {
        rsaVerify65537(nonPaddedHash, signatureBigint, publicKeyBigint);
      };

      await expect(isVerified).rejects.toThrow();
    });

    it('should reject verification when hash data is padded with incorrect PKCS#1 v1.5 format ', async () => {
      const digest = Gadgets.SHA2.hash(256, signedData);

      //Steps below are identical to the `verifySignature` method steps.

      const wronglyPaddedHash = pkcs1v15PadWrong(digest);
      // First, try it with padded hash value.

      const isVerified = async () => {
        rsaVerify65537(wronglyPaddedHash, signatureBigint, publicKeyBigint);
      };

      await expect(isVerified).rejects.toThrow();
    });

    it('should reject verification when hash data is padded with incorrect PKCS#1 v1.5 format ', async () => {
      const digest = Gadgets.SHA2.hash(256, signedData);

      //Steps below are identical to the `verifySignature` method steps.

      const wronglyPaddedHash = pkcs1v15PadWrong(digest);
      // First, try it with padded hash value.

      const isVerified = async () => {
        rsaVerify65537(wronglyPaddedHash, signatureBigint, publicKeyBigint);
      };

      await expect(isVerified).rejects.toThrow();
    });

    it('should reject signatures with SHA-384 digests ', async () => {
      const digest = Gadgets.SHA2.hash(384, signedData);

      //Steps below are identical to the `verifySignature` method steps.

      const paddedHash = pkcs1v15Pad(digest);
      // First, try it with padded hash value.

      const isVerified = async () => {
        rsaVerify65537(paddedHash, signatureBigint, publicKeyBigint);
      };

      await expect(isVerified).rejects.toThrow(
        'Field.assertEquals(): 31644031178026440823572775767911610 != 9188579551671412591472664553230141'
      );
    });
    it('should reject signatures with SHA-512 digests ', async () => {
      const digest = Gadgets.SHA2.hash(512, signedData);

      //Steps below are identical to the `verifySignature` method steps.

      const paddedHash = pkcs1v15Pad(digest);
      // First, try it with padded hash value.

      const isVerified = async () => {
        rsaVerify65537(paddedHash, signatureBigint, publicKeyBigint);
      };

      await expect(isVerified).rejects.toThrow(
        'Field.assertEquals(): 50469815090039084110515593114079551 != 9188579551671412591472664553230141'
      );
    });
    it('should reject signature verification of a different data', async () => {
      const inputs = getQRData(TEST_DATA_2);
      const otherData = inputs.signedData;

      const blocks = prepareRecursiveHashData(otherData);

      const { proof } = await hashWrapper.run(blocks);

      const isVerified = async () => {
        await SignatureVerifier.verifySignature(
          proof,
          signatureBigint,
          publicKeyBigint
        );
      };

      await expect(isVerified).rejects.toThrow();
    });
    it('should reject signature verification of a different signature', async () => {
      const inputs = getQRData(TEST_DATA_2);
      const otherSignature = inputs.signatureBigint;

      const blocks = prepareRecursiveHashData(signedData);

      const { proof } = await hashWrapper.run(blocks);

      const isVerified = async () => {
        await SignatureVerifier.verifySignature(
          proof,
          otherSignature,
          publicKeyBigint
        );
      };

      await expect(isVerified).rejects.toThrow();
    });
    it('should reject signature verification of empty data', async () => {
      const EMPTY_DATA = signedData.slice(0, 0);

      const blocks = prepareRecursiveHashData(EMPTY_DATA);

      const { proof } = await hashWrapper.run(blocks);

      const isVerified = async () => {
        await SignatureVerifier.verifySignature(
          proof,
          signatureBigint,
          publicKeyBigint
        );
      };

      await expect(isVerified).rejects.toThrow();
    });
  });
});
