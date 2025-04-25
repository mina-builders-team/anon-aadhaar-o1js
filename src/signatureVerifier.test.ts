import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import {
  convertBigIntToByteArray,
  decompressByteArray,
} from '@anon-aadhaar/core';

import { bufferToHex } from '@zk-email/helpers';

import { SignatureVerifier } from './signatureVerifier';
import { Bytes, Field, Gadgets, Struct, UInt8, ZkProgram } from 'o1js';
import { Bigint2048 } from './rsa';
import { wordToBytes } from './utils';

const proofsEnabled = false;

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const qrPath = path.resolve(__dirname, '../src/assets/test.json');
const certPath = path.resolve(__dirname, '../src/assets/testPublicKey.pem');

describe('Signature Verifier', () => {
  let qrData: string;
  let pkData: string;
  let publicKey: crypto.KeyObject;
  let testQRData: string;
  let QRData: bigint;

  let qrDataBytes: Uint8Array<ArrayBufferLike>;
  let decodedData: Uint8Array<ArrayBufferLike>;

  let signatureBytes: Uint8Array<ArrayBufferLike>;
  let signedData: Uint8Array<ArrayBufferLike>;

  let publicKeyBigint: Bigint2048;
  let signatureBigint: Bigint2048;

  beforeAll(async () => {
    await SignatureVerifier.compile({ proofsEnabled });

    // Get QR data file
    qrData = fs.readFileSync(qrPath, 'utf8');

    // Get public key data from certificate
    pkData = fs.readFileSync(certPath, 'utf8');

    // Generate public key from certificate.
    publicKey = crypto.createPublicKey(pkData);

    // Get the test QR data
    testQRData = JSON.parse(qrData).testQRData;

    // Convert QR data to bigint
    QRData = BigInt(testQRData);

    // Parse qr data and convert it to decompressed bytes step by step (using Aadhaar SDK)
    // Convert QR data bigint to byte array and decompress it
    qrDataBytes = convertBigIntToByteArray(QRData);
    decodedData = decompressByteArray(qrDataBytes);

    // Split signature and signed data
    signatureBytes = decodedData.slice(
      decodedData.length - 256,
      decodedData.length
    );

    signedData = decodedData.slice(0, decodedData.length - 256);

    // Convert pubkey from byte array to BigInt type.
    publicKeyBigint = Bigint2048.from(
      BigInt(
        '0x' +
          bufferToHex(
            Buffer.from(
              publicKey.export({ format: 'jwk' }).n as string,
              'base64url'
            )
          )
      )
    );

    // Convert signature from byte array to BigInt type.
    signatureBigint = Bigint2048.from(
      BigInt('0x' + bufferToHex(Buffer.from(signatureBytes)).toString())
    );
  });

  describe('Partial hashing computations', () => {
    it.skip('should compute partial hashing with 9 byte blocks of size 128 bytes.', async () => {
      //
      // Warning: This step is used for testing 128-byte hashing. Remove .skip if you want to experiment the full proof generation.
      //

      // Pad the blocks for SHA256 processes. Padding of the internal SHA256 function will be used here.

      const properlyPaddedBlocks = Gadgets.SHA256.padding(signedData);

      // Process these blocks in chunks if needed
      const initialValue = Gadgets.SHA256.initialState;

      // If you want to split at specific byte boundaries, first convert blocks to bytes
      let paddedData = Bytes.from(
        properlyPaddedBlocks
          .flat()
          .map((word) => word.toBytesBE())
          .flat()
      );

      // Now split at your desired boundaries (multiple of 64 bytes)

      const paddedBytes = [];
      for (let i = 0; i < 9; i++) {
        paddedBytes[i] = Bytes.from(
          paddedData.toBytes().slice(i * 128, 128 * (i + 1))
        );
      }
      // Compute proofs recursively
      const proof1 = await SignatureVerifier.baseCase128(
        paddedBytes[0],
        initialValue
      );
      const proof2 = await SignatureVerifier.hashStep128(
        proof1.proof,
        paddedBytes[1]
      );
      const proof3 = await SignatureVerifier.hashStep128(
        proof2.proof,
        paddedBytes[2]
      );
      const proof4 = await SignatureVerifier.hashStep128(
        proof3.proof,
        paddedBytes[3]
      );
      const proof5 = await SignatureVerifier.hashStep128(
        proof4.proof,
        paddedBytes[4]
      );
      const proof6 = await SignatureVerifier.hashStep128(
        proof5.proof,
        paddedBytes[5]
      );
      const proof7 = await SignatureVerifier.hashStep128(
        proof6.proof,
        paddedBytes[6]
      );
      const proof8 = await SignatureVerifier.hashStep128(
        proof7.proof,
        paddedBytes[7]
      );
      const proof9 = await SignatureVerifier.hashStep128(
        proof8.proof,
        paddedBytes[8]
      );

      const result = proof9.proof.publicOutput;

      // Get final digest
      const finalDigest = Bytes.from(
        result.hashState.map((x) => wordToBytes(x.value, 4, true)).flat()
      );

      const expectedDigest = Gadgets.SHA2.hash(256, signedData);
      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    });

    it('should compute partial hashing with byte blocks split by 512-512-128.', async () => {
      // Pad the blocks for SHA256 processes. Padding of the internla SHA256 function will be used here.

      const properlyPaddedBlocks = Gadgets.SHA256.padding(signedData);

      // Process these blocks in chunks if needed
      const initialValue = Gadgets.SHA256.initialState;

      // If you want to split at specific byte boundaries, first convert blocks to bytes
      let paddedData = Bytes.from(
        properlyPaddedBlocks
          .flat()
          .map((word) => word.toBytesBE())
          .flat()
      );

      // Now split at your desired boundaries (multiple of 64 bytes)
      const pad1 = Bytes.from(paddedData.toBytes().slice(0, 512));
      const pad2 = Bytes.from(paddedData.toBytes().slice(512, 1024));
      const pad3 = Bytes.from(paddedData.toBytes().slice(1024));

      const proof1 = await SignatureVerifier.baseCase(pad1, initialValue);
      const proof2 = await SignatureVerifier.hashStep(proof1.proof, pad2);
      const proof3 = await SignatureVerifier.hashStep128(proof2.proof, pad3);

      const result3 = proof3.proof.publicOutput;

      // Get final digest
      const finalDigest = Bytes.from(
        result3.hashState.map((x) => wordToBytes(x.value, 4, true)).flat()
      );

      const expectedDigest = Gadgets.SHA2.hash(256, signedData);
      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
      const timeEnd = performance.now();
    });
  });

  describe('Signature verification computations', () => {
    it('should verify rsa signature correctly', async () => {
      // Pad the blocks for SHA256 processes. Padding of the internla SHA256 function will be used here.
      const properlyPaddedBlocks = Gadgets.SHA256.padding(signedData);

      // Process these blocks in chunks if needed
      const initialValue = Gadgets.SHA256.initialState;

      // If you want to split at specific byte boundaries, first convert blocks to bytes
      let paddedData = Bytes.from(
        properlyPaddedBlocks
          .flat()
          .map((word) => word.toBytesBE())
          .flat()
      );

      // Now split at your desired boundaries (multiple of 64 bytes)
      const pad1 = Bytes.from(paddedData.toBytes().slice(0, 512));
      const pad2 = Bytes.from(paddedData.toBytes().slice(512, 1024));
      const pad3 = Bytes.from(paddedData.toBytes().slice(1024));

      const proof1 = await SignatureVerifier.baseCase(pad1, initialValue);
      const proof2 = await SignatureVerifier.hashStep(proof1.proof, pad2);
      const proof3 = await SignatureVerifier.hashStep128(proof2.proof, pad3);

      // Should throw an error if verification fails.
      await SignatureVerifier.verifySignature(
        proof3.proof,
        signatureBigint,
        publicKeyBigint
      );
    });
  });
});
