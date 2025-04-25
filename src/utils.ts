import { Bytes, UInt32, Gadgets, Provable, Field, UInt8, assert } from 'o1js';
import { Bigint2048 } from './rsa';
import pako from 'pako';

/**
 * Creates a PKCS#1 v1.5 padded message for the given SHA-256 digest.
 *
 * @note This function follows the RFC3447 standard: https://datatracker.ietf.org/doc/html/rfc3447#section-9.2
 *
 * @param sha256Digest The SHA-256 digest to be padded.
 * @param modulusLength The size of the RSA modulus in bytes.
 * @returns The padded PKCS#1 v1.5 message.
 * @notice - Copied from https://github.com/mohammed7s/zk-email-o1js/blob/main/src/utils.ts
 */
export function pkcs1v15Pad(sha256Digest: Bytes) {
  // Algorithm identifier (OID) for SHA-256 in PKCS#1 v1.5 padding
  const algorithmConstantBytes = Bytes.fromHex(
    '3031300d060960864801650304020105000420'
  ).bytes;

  // Calculate the length of the padding string (PS)
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
 * Updates a SHA-256 hash with new data, starting from an initial hash state
 *
 * @param initialHashValue - The initial hash state (8 UInt32 values)
 * @param paddedPreimage - The padded data to process (must be a multiple of 64 bytes)
 * @returns Object containing all intermediate states and the final hash state
 */
export function updateHash(
  initialHashValue = Gadgets.SHA2.initialState(256) as UInt32[],
  paddedPreimage: Bytes
): { hashState: UInt32[] } {
  // Split the padded preimage into 512-bit (64-byte) blocks
  // TODO: investigate if it is better to do it out of the circuit.
  const messageBlocks = generateMessageBlocks(paddedPreimage);

  // Create array to store hash states after each block
  let hashValues: UInt32[][] = Array.from(
    { length: messageBlocks.length + 1 },
    () => [UInt32.from(0)]
  );

  // Initialize with the provided hash state
  hashValues[0] = [...initialHashValue];

  // Process each message block
  for (let i = 0; i < messageBlocks.length; i++) {
    // Create message schedule for current block
    const messageSchedule = Gadgets.SHA256.createMessageSchedule(
      messageBlocks[i]
    );

    // Update hash state using compression function
    hashValues[i + 1] = [
      ...Gadgets.SHA256.compression(hashValues[i], messageSchedule),
    ];
  }

  // Return the hashState
  return {
    hashState: hashValues[hashValues.length - 1],
  };
}

/**
 * Converts a Field element to an array of UInt8 values, assuming little endian representation by default.
 *
 * @param word - The Field element to be converted.
 * @param bytesPerWord - The number of bytes per word. Defaults to 8.
 * @param reverseEndianness - A boolean indicating whether to reverse the endianness. Defaults to false.
 * @returns An array of UInt8 representing the bytes of the input Field element.
 * @notice Copied from https://github.com/Shigoto-dev19/o1js-dynamic-sha256/blob/main/src/utils.ts
 */
export function wordToBytes(
  word: Field,
  bytesPerWord = 8,
  reverseEndianness = false
): UInt8[] {
  let bytes = Provable.witness(Provable.Array(UInt8, bytesPerWord), () => {
    let w = word.toBigInt();
    return Array.from({ length: bytesPerWord }, (_, k) => {
      const shiftBits = reverseEndianness ? 3 - k : k;
      return UInt8.from((w >> BigInt(8 * shiftBits)) & 0xffn);
    });
  });

  // Verify the decomposition by converting the bytes back to a Field and comparing to the original word
  bytesToWord(bytes, reverseEndianness).assertEquals(word);

  return bytes;
}

/**
 * Converts an array of UInt8 to a Field element, assuming little endian representation by default.
 *
 * @param wordBytes - An array of UInt8 representing the bytes to be converted.
 * @param reverseEndianness - A boolean indicating whether to reverse the endianness. Defaults to false.
 * @returns A Field element representing the combined value of the input bytes.
 * @notice Copied from https://github.com/Shigoto-dev19/o1js-dynamic-sha256/blob/main/src/utils.ts
 */
function bytesToWord(wordBytes: UInt8[], reverseEndianness = false): Field {
  return wordBytes.reduce((acc, byte, idx) => {
    const shiftBits = reverseEndianness ? 3 - idx : idx;
    const shift = 1n << BigInt(8 * shiftBits);
    return acc.add(byte.value.mul(shift));
  }, Field.from(0));
}

/**
 * Splits a padded message into 512-bit (64-byte) message blocks for SHA-256 processing.
 *
 * @param paddedMessage - The input Bytes object representing the padded message.
 * @returns An array of 512-bit message blocks, each block containing 16 UInt32 words.
 * @notice - Copied from https://github.com/Shigoto-dev19/o1js-dynamic-sha256/blob/main/src/utils.ts
 */
export function generateMessageBlocks(paddedMessage: Bytes): UInt32[][] {
  // Split the message into 32-bit chunks
  const chunks: UInt32[] = [];

  for (let i = 0; i < paddedMessage.length; i += 4) {
    // Chunk 4 bytes into one UInt32, as expected by SHA-256
    // bytesToWord expects little endian, so we reverse the bytes
    const chunk = UInt32.Unsafe.fromField(
      bytesToWord(paddedMessage.bytes.slice(i, i + 4).reverse())
    );
    chunks.push(chunk);
  }

  // Split message into 16-element sized message blocks
  // SHA-256 expects n-blocks of 512 bits each, 16 * 32 bits = 512 bits
  return chunk(chunks, 16);
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @param array - The array to be split into chunks.
 * @param size - The size of each chunk.
 * @returns A 2D array where each sub-array is a chunk of the specified size.
 * @throws Will throw an error if the length of the array is not a multiple of the chunk size.
 * @notice Copied from https://github.com/o1-labs/o1js/blob/main/src/lib/util/arrays.ts
 */
function chunk<T>(array: T[], size: number): T[][] {
  assert(
    array.length % size === 0,
    `Array length must be a multiple of ${size}`
  );
  return Array.from({ length: array.length / size }, (_, i) =>
    array.slice(size * i, size * (i + 1))
  );
}

/**
 * Converts a `bigint` value into a `Uint8Array` byte array representation.
 *
 * The conversion is done in little-endian order (least significant byte first),
 * and the resulting array is reversed to produce big-endian format (most significant byte first),
 * which is the conventional format for cryptographic and binary protocols.
 *
 * @param bigInt - The bigint value to convert into a byte array.
 * @returns A `Uint8Array` representing the input bigint in big-endian byte order.
 * @notice - Copied from https://github.com/anon-aadhaar/anon-aadhaar/blob/main/packages/core/src/utils.ts
 */
export function convertBigIntToByteArray(bigInt: bigint): Uint8Array {
  const byteLength = Math.max(1, Math.ceil(bigInt.toString(2).length / 8));

  const result = new Uint8Array(byteLength);
  let i = 0;
  while (bigInt > 0) {
    result[i] = Number(bigInt % BigInt(256));
    bigInt = bigInt / BigInt(256);
    i += 1;
  }
  return result.reverse();
}

/**
 * Decompresses a compressed byte array (e.g., gzip or deflate format) using the `pako` library.
 *
 * This function is typically used to decompress data that has been compressed using zlib/deflate,
 * such as Aadhaar QR payloads or similar.
 *
 * @param byteArray - The compressed `Uint8Array` to decompress.
 * @returns A decompressed `Uint8Array` containing the original data.
 * @notice - Copied from https://github.com/anon-aadhaar/anon-aadhaar/blob/main/packages/core/src/utils.ts
 */
export function decompressByteArray(byteArray: Uint8Array): Uint8Array {
  const decompressedArray = pako.inflate(byteArray);
  return decompressedArray;
}
