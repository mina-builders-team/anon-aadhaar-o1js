import { Bytes, Field, Provable, UInt32 } from 'o1js';
import { BLOCK_SIZES } from './utils.js';
import { RecursiveHash, RecursiveHashProof } from './recursiveHash.js';
import { Bigint2048 } from './rsa.js';
export {
  compute512BasedHash,
  computeChained128Hash,
  compute512BasedHashDigest,
  computeChained128HashDigest,
  pkcs1v15PadWrong,
  createDelimitedData,
  charBytesToInt,
  intToCharString,
};

async function compute512BasedHash(
  paddedData: Bytes,
  initialValue: UInt32[]
): Promise<RecursiveHashProof> {
  const byteData = paddedData.toBytes();

  const pad1 = Bytes.from(byteData.slice(0, BLOCK_SIZES.MEDIUM));

  const pad2 = Bytes.from(
    byteData.slice(BLOCK_SIZES.MEDIUM, BLOCK_SIZES.LARGE)
  );
  const pad3 = Bytes.from(byteData.slice(BLOCK_SIZES.LARGE));

  const proof1 = await RecursiveHash.baseCase512(pad1, initialValue);
  const proof2 = await RecursiveHash.hashStep512(proof1.proof, pad2);
  const finalProof = await RecursiveHash.hashStep128(proof2.proof, pad3);

  return finalProof.proof;
}

async function compute512BasedHashDigest(
  paddedData: Bytes,
  initialValue: UInt32[]
): Promise<Bytes> {
  const byteData = paddedData.toBytes();

  const pad1 = Bytes.from(byteData.slice(0, BLOCK_SIZES.MEDIUM));

  const pad2 = Bytes.from(
    byteData.slice(BLOCK_SIZES.MEDIUM, BLOCK_SIZES.LARGE)
  );
  const pad3 = Bytes.from(byteData.slice(BLOCK_SIZES.LARGE));

  const proof1 = await RecursiveHash.baseCase512(pad1, initialValue);
  const proof2 = await RecursiveHash.hashStep512(proof1.proof, pad2);
  const finalProof = await RecursiveHash.hashStep128(proof2.proof, pad3);

  const result = finalProof.proof.publicOutput;

  // Get final digest
  const finalDigest = Bytes.from(
    result.hashState.flatMap((w: UInt32) => w.toBytesBE())
  );

  return finalDigest;
}

async function computeChained128Hash(
  paddedData: Bytes,
  initialValue: UInt32[]
): Promise<RecursiveHashProof> {
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

  return finalProof.proof;
}

async function computeChained128HashDigest(
  paddedData: Bytes,
  initialValue: UInt32[]
): Promise<Bytes> {
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

  return finalDigest;
}

/**
 * Pads message using a wrong PKCS#1 v1.5 algorithm identifiers for the given SHA-256 digest.
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
