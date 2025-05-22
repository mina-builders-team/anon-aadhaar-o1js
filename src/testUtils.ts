import { Bytes, Field, Provable } from 'o1js';
import { commitBlock256, padding256, state32ToBytes } from './utils.js';
import { Bigint2048, rsaVerify65537 } from './rsa.js';
import { DynamicBytes } from 'mina-attestations';
import { MerkleBlocks } from './dataTypes.js';
import { SignatureVerifier } from './signatureVerifier.js';
import { recursiveHash } from './recursion.js';
export {
  pkcs1v15PadWrong,
  createDelimitedData,
  charBytesToInt,
  intToCharString,
  createPaddedQRData,
  expectSignatureCircuitError,
  expectSignatureError,
  generateHashFromData,
  prepareRecursiveHashData
};

/**
 * Pads a SHA-256 digest using an intentionally incorrect PKCS#1 v1.5 padding scheme.
 * This is useful for testing or invalid padding proofs.
 *
 * @param sha256Digest - SHA-256 digest to be padded.
 * @returns A `Bigint2048` witness representing the padded digest.
 *
 * @notice Copied from above and modified the algorithm constants for obtaining wrongly padded data.
 */
function pkcs1v15PadWrong(sha256Digest: Bytes) {
  // Wrongly given algorithm identifier (OID) for SHA-256 in PKCS#1 v1.5 padding
  const algorithmConstantBytes = Bytes.fromHex(
    '3031301d060660864301650304020105000420'
  ).bytes;

  // Calculate the length of the padding string (PS)
  // It is calculated with: modulusLength - sha256Digest.length - algorithmConstantBytes.length - 3;
  // It is set to be 202, since values are constant:
  // modulus length: 256 bytes (2048 bits)
  // sha256 digest Length: 32 bytes
  // algorithm constant bytes' length: 19 bytes
  const padLength = 202;

  // Create the padding string (PS) with 0xFF bytes based on padLength
  const paddingString = Bytes.from(new Array(padLength).fill(0xff));

  // Assemble the PKCS#1 v1.5 padding components
  const padding = [
    ...Bytes.fromHex('0001').bytes, // Block type (BT) 00 01
    ...paddingString.bytes, // Padding string (PS)
    ...Bytes.fromHex('00').bytes, // Separator byte 00
    ...algorithmConstantBytes, // Algorithm identifier (OID)
    ...sha256Digest.bytes, // SHA-256 digest
  ];

  // Convert the padded message to a byte array
  const paddedHash = Bytes.from(padding);

  // Create a Bigint2048 witness from the padded hash
  const message = Provable.witness(Bigint2048, () => {
    const hexString = '0x' + paddedHash.toHex();
    return Bigint2048.from(BigInt(hexString));
  });

  return message;
}

/**
 * Marks a specific index in a numeric array using delimiter encoding.
 * Values of `255` before the `photoIndex` are multiplied sequentially (255, 510, 765...).
 *
 * @param data - The original numeric data array.
 * @param photoIndex - Index before which delimiters are applied.
 * @returns A new array with delimited values.
 */
function createDelimitedData(data: number[], photoIndex: number): number[] {
  // Started from one, we want first multiplier to be one and then proceed.
  let n = 1;

  const result = data.map((value, i) => {
    if (i < photoIndex && value === 255 && n <= 18) {
      return 255 * n++;
    }
    return value;
  });

  return result;
}

/**
 * Converts character bytes to an integer
 * For example: Character 'A', 'B', 'C' becomes integer value based on ASCII codes
 *
 * @param bytes - Array of Field values representing ASCII character codes
 * @param numBytes - Number of bytes to process
 * @returns Field containing the integer value
 */
function charBytesToInt(bytes: Field[], numBytes: number): Field {
  let result = Field.from(0);

  // Process each byte and incorporate it into the result
  for (let i = 0; i < numBytes; i++) {
    // Shift the existing value left by 8 bits (multiply by 256)
    result = result.mul(256);

    // Add the new byte value
    result = result.add(bytes[i]);
  }

  return result;
}

/**
 * Converts an integer to a character string
 * For example: Integer value is converted to ASCII characters
 *
 * @param value - The integer value to convert
 * @param numBytes - Number of bytes/characters to output
 * @returns String representation of the character bytes
 */
function intToCharString(value: Field, numBytes: number): string {
  // Create array for storing byte values
  const byteValues: number[] = new Array(numBytes).fill(0);

  // Convert Field to number (this happens outside the circuit)
  let remainingValue = Number(value.toString());

  // Extract bytes from right to left
  for (let i = numBytes - 1; i >= 0; i--) {
    // Get the rightmost byte (value % 256)
    const byteValue = remainingValue % 256;

    // Store the byte value as a number
    byteValues[i] = byteValue;

    // Remove the rightmost byte (value / 256)
    remainingValue = Math.floor(remainingValue / 256);
  }

  // Convert byte values to characters and join them into a string
  return String.fromCharCode(...byteValues);
}

/**
 * Converts a `Uint8Array` into a fixed-length array of `Field` elements (length 1536).
 * Useful for padding data to fit a circuit or QR data constraint.
 *
 * @param inputData - The input byte array.
 * @returns A padded array of numbers representing `Field` elements.
 */
function createPaddedQRData(inputData: Uint8Array) {
  const dataArray = [];

  // Add actual data
  for (let i = 0; i < inputData.length; i++) {
    dataArray.push(inputData[i]);
  }

  // Pad with zeros to reach exactly 1536 elements
  for (let i = inputData.length; i < 1536; i++) {
    dataArray.push(0);
  }

  return dataArray;
}


function prepareRecursiveHashData(data: Uint8Array): MerkleBlocks{
  const dynamicData = DynamicBytes.from(data);
  const dynamicDataPadded = padding256(dynamicData);
  const dynamicDataBlocks = dynamicDataPadded.merkelize(commitBlock256);

  return dynamicDataBlocks;
}


async function generateHashFromData(data: Uint8Array): Promise<Bytes> {
  const dynamicData = DynamicBytes.from(data);
  const dynamicDataPadded = padding256(dynamicData);
  const dynamicDataBlocks = dynamicDataPadded.merkelize(commitBlock256);
  const hash = await recursiveHash.run(dynamicDataBlocks);

  const finalDigest = state32ToBytes(hash);

  return finalDigest;
}

async function expectSignatureCircuitError(
  blocks: MerkleBlocks,
  signature: Bigint2048,
  publicKeyBigint: Bigint2048,
  expectedMsgTrue: string,
  expectedMsgFalse: string,
  proofsEnabled: boolean
) {
  try {
    await SignatureVerifier.verifySignature(blocks, signature, publicKeyBigint);
    throw new Error(
      'Expected isVerified to throw an error message, but it did not'
    );
  } catch (err) {
    const msg = (err as Error).message;

    if (proofsEnabled) {
      expect(msg).toContain(expectedMsgTrue);
      expect(msg).toContain('Constraint unsatisfied');
    } else {
      expect(msg).toContain(expectedMsgFalse);
    }
  }
}

async function expectSignatureError(
  paddedHash: Bigint2048,
  signature: Bigint2048,
  publicKeyBigint: Bigint2048,
  expectedMsgTrue: string,
  expectedMsgFalse: string,
  proofsEnabled: boolean
) {
  try {
    rsaVerify65537(paddedHash, signature, publicKeyBigint);
    throw new Error(
      'Expected isVerified to throw an error message, but it did not'
    );
  } catch (err) {
    const msg = (err as Error).message;

    if (proofsEnabled) {
      expect(msg).toContain(expectedMsgTrue);
      expect(msg).toContain('Constraint unsatisfied');
    } else {
      expect(msg).toContain(expectedMsgFalse);
    }
  }
}
