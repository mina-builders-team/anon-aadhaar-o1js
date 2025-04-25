import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import { bufferToHex } from '@zk-email/helpers';

import { Bigint2048 } from './rsa';
import {
  convertBigIntToByteArray,
  decompressByteArray,
} from '@anon-aadhaar/core';

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
});
