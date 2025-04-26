import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Gadgets, UInt32, Bytes } from 'o1js';
import { Bigint2048 } from '../rsa.js';
import { bufferToHex } from '@zk-email/helpers';
import { SignatureVerifier } from '../SignatureVerifier.js';
import {
  convertBigIntToByteArray,
  decompressByteArray,
  BLOCK_SIZES,
} from '../utils.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const qrPath = path.resolve(__dirname, '../assets/test.json');
const certPath = path.resolve(__dirname, '../assets/testPublicKey.pem');

// Get data as strings from paths. By cho
const qrData = fs.readFileSync(qrPath, 'utf8');
const pkData = fs.readFileSync(certPath, 'utf8');

// Generate public key from certificate.
const publicKey = crypto.createPublicKey(pkData);
const testQRData: string = JSON.parse(qrData).testQRData;

// Convert QR data to bigintx
const QRData = BigInt(testQRData);

// Parse qr data and convert it to decompressed bytes step by step (using Aadhaar SDK)
// Convert QR data bigint to byte array and decompress it
const qrDataBytes = convertBigIntToByteArray(QRData);
const decodedData = decompressByteArray(qrDataBytes);

// Split signature and signed data. Signature in aadhaar QR data is the last 256 bytes.
const signatureBytes = decodedData.slice(
  decodedData.length - 256,
  decodedData.length
);

// Slice the data for getting the sliced data
const signedData = decodedData.slice(0, decodedData.length - 256);

// Convert pubkey from byte array to BigInt type.
const publicKeyBigint = Bigint2048.from(
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
const signatureBigint = Bigint2048.from(
  BigInt('0x' + bufferToHex(Buffer.from(signatureBytes)).toString())
);

// Pad the blocks for SHA256 processes. Padding of the internla SHA256 function will be used here.
const properlyPaddedBlocks = Gadgets.SHA2.padding(256, signedData);

// Get the initial state needed for SHA256.
const initialValue: UInt32[] = Gadgets.SHA2.initialState(256);

// Convert padded Data from blocks to bytes.
let paddedData = Bytes.from(
  properlyPaddedBlocks
    .flat()
    .map((word) => word.toBytesBE())
    .flat()
);


console.time('Compile');
await SignatureVerifier.compile();
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
await proof.verify();
console.timeEnd('Verification');
