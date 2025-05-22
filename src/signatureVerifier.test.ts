import { SignatureVerifier } from './signatureVerifier.js';

import { Gadgets } from 'o1js';
import { Bigint2048 } from './rsa.js';

import { pkcs1v15Pad } from './utils.js';
import { getQRData, TEST_DATA, TEST_DATA_2 } from './getQRData.js';

import {
  pkcs1v15PadWrong,
  prepareRecursiveHashData,
  expectSignatureError,
  expectSignatureCircuitError,
} from './testUtils.js';

import { hashProgram, recursiveHashProgram } from './recursion.js';

const proofsEnabled = true;

describe('Signature Verifier', () => {
  let publicKeyBigint: Bigint2048;
  let signatureBigint: Bigint2048;
  let signedData: Uint8Array;

  beforeAll(async () => {
    await hashProgram.compile({ proofsEnabled });
    await recursiveHashProgram.compile({ proofsEnabled });
    await SignatureVerifier.compile({ proofsEnabled });

    const inputs = getQRData(TEST_DATA);

    publicKeyBigint = inputs.publicKeyBigint;
    signatureBigint = inputs.signatureBigint;
    signedData = inputs.signedData;
  });

  describe('Signature verification computations', () => {
    it('should verify rsa signature correctly', async () => {
      const blocks = prepareRecursiveHashData(signedData);

      // Should throw an error if verification fails.
      await SignatureVerifier.verifySignature(
        blocks,
        signatureBigint,
        publicKeyBigint
      );
    });

    it('should reject verification with tampered signature', async () => {
      const wrongSignature = signatureBigint.modSquare(publicKeyBigint);
      const blocks = prepareRecursiveHashData(signedData);
      // Error message to be used in proofsEnabled:true option
      const expectedMsgTrue =
        'Equal 9188579551671412591472664553230141 40899547542153145199703733613250199';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 9188579551671412591472664553230141 != 40899547542153145199703733613250199';

      await expectSignatureCircuitError(
        blocks,
        wrongSignature,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        proofsEnabled
      );
    });

    it('should reject verification with wrong public key', async () => {
      // A completely different & weird value
      const wrongPublicKeyHex =
        '61e81f7506595cc262addcfddd35d704055b2adf46dc619c56b48eee199995eca1a3254710620ac7801e976f44e3be454db0f190e3f7d4e3598972117344de52fcf7826f849488a959a7b3d21eb6dd03451662ea883eeeefde889a1499b9a47f9504c5f096c262b96d23d19750332d9e97eb6141d261de97994d4c4163ca9cbe3e077221b44253dcf81609428b68351ee3e9b60d2b351fdaa6ee8c28a845239f97de7cc0fe5d144e474813fb43ec583f81b4ee328c22167334898d210ba017a26ec68940f05df22bd9cc86bbc3a4354392372d566167769b735ba12ca3580f919c1bd8ba70c4c2ab0acf2b09bc2fae981f3c0295a6e1e9f248f50073094ffaf1';
      const wrongPublicKey = Bigint2048.from(BigInt('0x' + wrongPublicKeyHex));

      const blocks = prepareRecursiveHashData(signedData);

      // Error message to be used in proofsEnabled:true option
      const expectedMsgTrue =
        'Equal 9188579551671412591472664553230141 19665786662882214150578387368928633';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 9188579551671412591472664553230141 != 19665786662882214150578387368928633';

      await expectSignatureCircuitError(
        blocks,
        signatureBigint,
        wrongPublicKey,
        expectedMsgTrue,
        expectedMsgFalse,
        proofsEnabled
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

      const isVerified = async () => {
        await SignatureVerifier.verifySignature(
          blocks,
          signatureBigint,
          publicKeyBigint
        );
      };

      // Random data throws different messages every time, so trying to get the expected message is an unnecessary effort.
      await expect(isVerified).rejects.toThrow();
    });

    it('should reject verification when hash data lacks PKCS#1 v1.5 padding ', async () => {
      const digest = Gadgets.SHA2.hash(256, signedData);

      //Steps below are identical to the `verifySignature` method steps.

      // Error message to be used in proofsEnabled:true option
      const expectedMsgTrue =
        'Equal 15569117 32614225132466096153625214992617693';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 15569117 != 32614225132466096153625214992617693';

      const hash = Bigint2048.from(BigInt('0x' + digest.toHex()));
      // In out of circuit verifications, error is always printed in Field.assertEquals(). So even if proofsEnabled is true, we'll pass it as false to get the correct type of error message.
      await expectSignatureError(
        hash,
        signatureBigint,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        false
      );
    });

    it('should reject verification when hash data is padded with incorrect PKCS#1 v1.5 format ', async () => {
      const digest = Gadgets.SHA2.hash(256, signedData);

      // Error message to be used in proofsEnabled:true option
      const expectedMsgTrue =
        'Equal 32512813084447837801505478736187613 32614225132466096153625214992617693';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 32512813084447837801505478736187613 != 32614225132466096153625214992617693';

      const paddedHash = pkcs1v15PadWrong(digest);

      // In out of circuit verifications, error is always printed in Field.assertEquals(). So even if proofsEnabled is true, we'll pass it as false to get the correct type of error message.
      await expectSignatureError(
        paddedHash,
        signatureBigint,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        false
      );
    });

    it('should reject signatures with SHA-384 digests ', async () => {
      const digest = Gadgets.SHA2.hash(384, signedData);

      // Error message to be used in proofsEnabled:true option
      const expectedMsgTrue =
        'Equal 31644031178026440823572775767911610 9188579551671412591472664553230141';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 31644031178026440823572775767911610 != 9188579551671412591472664553230141';

      const paddedHash = pkcs1v15Pad(digest);
      // In out of circuit verifications, error is always printed in Field.assertEquals(). So even if proofsEnabled is true, we'll pass it as false to get the correct type of error message.
      await expectSignatureError(
        paddedHash,
        signatureBigint,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        false
      );
    });

    it('should reject signatures with SHA-512 digests ', async () => {
      const digest = Gadgets.SHA2.hash(512, signedData);

      const expectedMsgTrue =
        'Equal 50469815090039084110515593114079551 9188579551671412591472664553230141';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 50469815090039084110515593114079551 != 9188579551671412591472664553230141';

      const paddedHash = pkcs1v15Pad(digest);
      // In out of circuit verifications, error is always printed in Field.assertEquals(). So even if proofsEnabled is true, we'll pass it as false to get the correct type of error message.
      await expectSignatureError(
        paddedHash,
        signatureBigint,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        false
      );
    });
    it('should reject signature verification of a different data', async () => {
      const inputs = getQRData(TEST_DATA_2);
      const otherData = inputs.signedData;

      const blocks = prepareRecursiveHashData(otherData);

      const expectedMsgTrue =
        'Equal 2914443462457906719845331827558144 9188579551671412591472664553230141';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 2914443462457906719845331827558144 != 9188579551671412591472664553230141';

      await expectSignatureCircuitError(
        blocks,
        signatureBigint,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        proofsEnabled
      );
    });

    it('should reject signature verification of a different signature', async () => {
      const inputs = getQRData(TEST_DATA_2);
      const otherSignature = inputs.signatureBigint;

      const blocks = prepareRecursiveHashData(signedData);

      const expectedMsgTrue =
        'Equal 9188579551671412591472664553230141 2914443462457906719845331827558144';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 9188579551671412591472664553230141 != 2914443462457906719845331827558144';

      await expectSignatureCircuitError(
        blocks,
        otherSignature,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        proofsEnabled
      );
    });

    it('should reject signature verification of empty data', async () => {
      const EMPTY_DATA = signedData.slice(0, 0);

      const blocks = prepareRecursiveHashData(EMPTY_DATA);

      const expectedMsgTrue =
        'Equal 74028607801358283505814219305171029 9188579551671412591472664553230141';
      // Error message to be used in proofsEnabled:false option
      const expectedMsgFalse =
        'Field.assertEquals(): 74028607801358283505814219305171029 != 9188579551671412591472664553230141';

      await expectSignatureCircuitError(
        blocks,
        signatureBigint,
        publicKeyBigint,
        expectedMsgTrue,
        expectedMsgFalse,
        proofsEnabled
      );
    });
  });
});
