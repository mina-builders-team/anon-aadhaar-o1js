import {
  Bytes,
  UInt32,
  Gadgets,
  Provable,
  UInt8,
  assert,
  Field,
  Poseidon,
  ProvableType,
} from 'o1js';
import { Bigint2048 } from './rsa.js';
import pako from 'pako';
import { DynamicArray, StaticArray } from 'mina-attestations';
import { Block32, BlockBytes, State32, WordBytes } from './dataTypes.js';

export {
  pkcs1v15Pad,
  updateHash,
  decompressByteArray,
  getDelimiterIndices,
  selectSubarray,
  digitBytesToTimestamp,
  digitBytesToInt,
  commitBlock256,
  state32ToBytes,
  padding256,
  generateMessageBlocks,
};

/**
 * Creates a PKCS#1 v1.5 padded message for the given SHA-256 digest.
 *
 * @note This function follows the RFC3447 standard: https://datatracker.ietf.org/doc/html/rfc3447#section-9.2
 *
 * @param sha256Digest The SHA-256 digest to be padded.
 * @param modulusLength The size of the RSA modulus in bytes.
 * @returns The padded PKCS#1 v1.5 message.
 * @notice - Copied from https://github.com/mohammed7s/zk-email-o1js/blob/main/src/utils.ts#L15
 */
function pkcs1v15Pad(sha256Digest: Bytes) {
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
function updateHash(
  initialHashValue = Gadgets.SHA2.initialState(256) as UInt32[],
  paddedPreimage: Bytes
): { hashState: UInt32[] } {
  // Split the padded preimage into 512-bit (64-byte) blocks
  // TODO: investigate if it is better to do it out of the circuit.

  assert(
    paddedPreimage.length % 64 === 0,
    'Preimage must be padded to a multiple of 64 bytes'
  );

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
    const messageSchedule = Gadgets.SHA2.messageSchedule(256, messageBlocks[i]);

    // Update hash state using compression function
    hashValues[i + 1] = [
      ...Gadgets.SHA2.compression(256, hashValues[i], messageSchedule),
    ];
  }

  // Return the hashState
  return {
    hashState: hashValues[hashValues.length - 1],
  };
}

/**
 * Converts an array of UInt8 to a Field element, assuming little endian representation by default.
 *
 * @param wordBytes - An array of UInt8 representing the bytes to be converted.
 * @returns A Field element representing the combined value of the input bytes.
 * @notice Copied from https://github.com/Shigoto-dev19/o1js-dynamic-sha256/blob/main/src/utils.ts#L118
 */
function bytesToWord(wordBytes: UInt8[]): UInt32 {
  return UInt32.fromBytes(wordBytes);
}

/**
 * Splits a padded message into 512-bit (64-byte) message blocks for SHA-256 processing.
 *
 * @param paddedMessage - The input Bytes object representing the padded message.
 * @returns An array of 512-bit message blocks, each block containing 16 UInt32 words.
 * @notice - Copied from https://github.com/Shigoto-dev19/o1js-dynamic-sha256/blob/main/src/utils.ts#L46
 */
function generateMessageBlocks(paddedMessage: Bytes): UInt32[][] {
  // Split the message into 32-bit chunks
  const chunks: UInt32[] = [];

  for (let i = 0; i < paddedMessage.length; i += 4) {
    // Chunk 4 bytes into one UInt32, as expected by SHA-256
    // bytesToWord expects little endian, so we reverse the bytes
    const chunk = UInt32.from(
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
 * @notice Copied from https://github.com/o1-labs/o1js/blob/main/src/lib/util/arrays.ts#L5
 */
function chunk<T>(array: T[], size: number): T[][] {
  assert(
    array.length % size === 0,
    `Array length must be a multiple of ${size}`
  );
  // Return data array by chunking it by 'size'.
  return Array.from({ length: array.length / size }, (_, i) =>
    array.slice(size * i, size * (i + 1))
  );
}

/**
 * Decompresses a compressed byte array (e.g., gzip or deflate format) using the `pako` library.
 *
 * This function is typically used to decompress data that has been compressed using zlib/deflate,
 * such as Aadhaar QR payloads or similar.
 *
 * @param byteArray - The compressed `Uint8Array` to decompress.
 * @returns A decompressed `Uint8Array` containing the original data.
 * @notice - Copied from https://github.com/anon-aadhaar/anon-aadhaar/blob/main/packages/core/src/utils.ts#L115
 */
function decompressByteArray(byteArray: Uint8Array): Uint8Array {
  const decompressedArray = pako.inflate(byteArray);
  return decompressedArray;
}

/**
 * Finds the indices of delimiter bytes (255) in a padded data array.
 *
 * @param paddedData - A `Uint8Array` where delimiter bytes (value 255) are expected.
 * @returns An array of indices where the delimiter bytes are located, capped at 18 elements.
 */
function getDelimiterIndices(paddedData: Uint8Array): number[] {
  let delimiterIndices = [];
  for (let i = 0; i < paddedData.length; i++) {
    if (paddedData[i] === 255) {
      delimiterIndices.push(i);
    }
    if (delimiterIndices.length === 18) {
      break;
    }
  }

  return delimiterIndices;
}

/**
 * Converts an array of ASCII digit `Field` elements into a single integer `Field`.
 *
 * Each digit is assumed to be in ASCII format (e.g., '0' = 48, '1' = 49).
 *
 * @param digits - An array of `Field` elements representing ASCII digits.
 * @param numDigits - The number of digits to process from the array.
 * @returns A `Field` representing the full integer value.
 */
function digitBytesToInt(digits: Field[], numDigits: number): Field {
  let result = Field.from(0);
  const asciiZero = Field.from(48);

  let powersOfTen = Field.from(1);
  for (let i = 0; i < numDigits - 1; i++) {
    powersOfTen = powersOfTen.mul(10);
  }

  for (let i = 0; i < numDigits; i++) {
    // Convert ASCII digit (e.g., '0' = 48, '1' = 49) to actual value
    const digitValue = digits[i].sub(asciiZero);

    result = result.add(digitValue.mul(powersOfTen));
    powersOfTen = powersOfTen.div(10);
  }

  return result;
}

/**
 * Constructs a UNIX timestamp from date and time components provided as `Field` elements.
 *
 * This includes handling leap years and correctly calculating the total number of days
 * since the UNIX epoch (January 1, 1970).
 *
 * @param year - The year as a `Field` (e.g., 2024).
 * @param month - The month as a `Field` (1-based: January = 1).
 * @param day - The day of the month as a `Field`.
 * @param hour - The hour of the day as a `Field`.
 * @param minute - The minute of the hour as a `Field`.
 * @param second - The second of the minute as a `Field`.
 * @param maxYears - The maximum number of years to consider for leap year calculations.
 * @returns A `Field` representing the UNIX timestamp (seconds since 1970-01-01 00:00:00 UTC).
 */
function digitBytesToTimestamp(
  year: Field,
  month: Field,
  day: Field,
  hour: Field,
  minute: Field,
  second: Field,
  maxYears: number
): Field {
  // Days till previous month (0-indexed month)
  const daysTillPreviousMonth = [
    Field(0),
    Field(31),
    Field(59),
    Field(90),
    Field(120),
    Field(151),
    Field(181),
    Field(212),
    Field(243),
    Field(273),
    Field(304),
    Field(334),
  ];

  // Calculate days based on years since 1970
  const yearsSinceEpoch = year.sub(Field(1970));
  let daysPassed = yearsSinceEpoch.mul(Field(365));

  // Add days in current month
  daysPassed = daysPassed.add(day.sub(Field(1)));

  // Add days from previous months in current year
  let daysFromPreviousMonths = Field(0);
  for (let i = 0; i < 12; i++) {
    const isCurrentMonth = month.sub(Field(1)).equals(Field(i)).toField();
    daysFromPreviousMonths = daysFromPreviousMonths.add(
      isCurrentMonth.mul(daysTillPreviousMonth[i])
    );
  }
  daysPassed = daysPassed.add(daysFromPreviousMonths);

  // Calculate leap years
  const maxLeapYears = Math.floor((maxYears - 1972) / 4) + 1;

  // Handle leap years before current year
  let leapYearDays = Field(0);
  for (let i = 0; i < maxLeapYears; i++) {
    const leapYear = Field(1972 + i * 4);
    const isLeapYearBeforeCurrent = year.greaterThan(leapYear).toField();
    leapYearDays = leapYearDays.add(isLeapYearBeforeCurrent);

    // Special case: if current year is a leap year and date is after February
    const isCurrentLeapYear = year.equals(leapYear).toField();
    const isAfterFebruary = month.greaterThan(Field(2)).toField();
    leapYearDays = leapYearDays.add(isCurrentLeapYear.mul(isAfterFebruary));
  }
  daysPassed = daysPassed.add(leapYearDays);

  // Convert days to seconds and add time components
  let timestamp = daysPassed.mul(Field(86400)); // 86400 seconds in a day
  timestamp = timestamp.add(hour.mul(Field(3600))); // 3600 seconds in an hour
  timestamp = timestamp.add(minute.mul(Field(60))); // 60 seconds in a minute
  timestamp = timestamp.add(second);

  return timestamp;
}

/**
 * Provably select a subarray from an array of field elements.
 *
 * @notice The length of the output array can be reduced by setting `subarrayLength`.
 * @notice Based on https://demo.hedgedoc.org/s/Le0R3xUhB.
 * @notice Assumes field elements to be bytes in the input array.
 *
 * @param input - The input array of field elements.
 * @param startIndex - The starting index for the subarray selection.
 * @param subarrayLength - The length of the output subarray.
 *
 * @notice - Taken from https://github.com/Shigoto-dev19/zk-email-o1js/blob/5f99c6555d5780aec18b61eacc289f4383f8c276/src/utils.ts#L189
 *
 * @returns The selected subarray of bytes.
 * @throws Will throw an error if `subarrayLength` is greater than the input array length.
 */
function selectSubarray(
  input: Field[],
  startIndex: Field,
  subarrayLength: number
): Field[] {
  const maxArrayLen = input.length;
  assert(
    subarrayLength <= maxArrayLen,
    'Subarray length exceeds input array length!'
  );

  const bitLength = Math.ceil(Math.log2(maxArrayLen));
  const shiftBits = startIndex.toBits(bitLength);
  let tmp: Field[][] = Array.from({ length: bitLength }, () =>
    Array.from({ length: maxArrayLen }, () => Field(0))
  );

  for (let j = 0; j < bitLength; j++) {
    for (let i = 0; i < maxArrayLen; i++) {
      let offset = (i + (1 << j)) % maxArrayLen;
      // Shift left by 2^j indices if bit is 1
      if (j === 0) {
        tmp[j][i] = shiftBits[j]
          .toField()
          .mul(input[offset].sub(input[i]))
          .add(input[i]);
      } else {
        tmp[j][i] = shiftBits[j]
          .toField()
          .mul(tmp[j - 1][offset].sub(tmp[j - 1][i]))
          .add(tmp[j - 1][i]);
      }
    }
  }

  // Return last row
  let subarray: Field[] = [];
  for (let i = 0; i < subarrayLength; i++) {
    const selectedByte = tmp[bitLength - 1][i];

    subarray.push(selectedByte);
  }

  return subarray;
}

/**
 * Computes a Poseidon commitment to a block, combining a prior commitment with the packed hash of the block.
 *
 * @param {Field} commitment - The prior commitment.
 * @param {Block32} block - The block to commit to.
 * @returns {Field} The updated commitment.
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/dynamic/dynamic-sha2.ts#L521
 */
function commitBlock256(commitment: Field, block: Block32): Field {
  let blockHash = hashSafe(toFieldsPacked(block));
  return hashSafe([commitment, blockHash]);
}

/**
 * Computes a Poseidon hash of an array of values, using a length-based prefix for domain separation.
 *
 * @param {(Field | number | bigint)[]} fields - The input fields to hash.
 * @returns {Field} The resulting Poseidon hash.
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/dynamic/dynamic-hash.ts#L209
 */
function hashSafe(fields: (Field | number | bigint)[]) {
  // Get the length of the fields
  let n = fields.length;

  // Add prefix depending on the length of the data fields
  let prefix = n === 0 ? 'zero' : n % 2 === 0 ? 'even' : 'odd_';
  return Poseidon.hashWithPrefix(prefix, fields.map(Field));
}

/**
 * Converts a Block32 into a flat array of Fields, packing smaller values into fewer fields where possible.
 *
 * @param {Block32} block - The input block of 16 UInt32 elements.
 * @returns {Field[]} An array of Fields representing the packed block.
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/o1js-missing.ts#L175 and adapted from Block32.
 */
function toFieldsPacked(block: Block32): Field[] {
  // Get the provable type for Block32
  let type = ProvableType.get(Block32);

  // If the type doesn't have a toInput method, just use toFields directly
  if (type.toInput === undefined) return type.toFields(block);

  // Convert the block to input format, which gives fields and packed values
  let { fields = [], packed = [] } = toInput(block);

  // Start with any direct fields
  let result = [...fields];

  // Initialize variables for packing
  let current = Field(0);
  let currentSize = 0;

  // Process packed values
  for (let [field, size] of packed) {
    // If there's room in the current field, add this value
    if (currentSize + size < Field.sizeInBits) {
      // Multiply the field by 2^currentSize and add to current
      current = current.add(field.mul(1n << BigInt(currentSize)));
      currentSize += size;
    } else {
      // No more room - finalize the current field and start a new one
      result.push(current.seal());
      current = field;
      currentSize = size;
    }
  }

  // Add the last field if there's anything in it
  if (currentSize > 0) result.push(current.seal());

  return result;
}

/**
 * Converts a Block32 into an input format suitable for hashing or other cryptographic operations.
 *
 * @param {Block32} block - The 16-element array of UInt32 values.
 * @returns {{ fields: Field[] } | { fields: Field[], packed: [Field, number][] }}
 * The input representation, either with only fields or with both fields and packed values.
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/o1js-missing.ts#L319 and adapted for Block32
 */
function toInput(block: Block32) {
  // Get the provable type for Block32
  const type = ProvableType.get(Block32);

  // If the type has a toInput method, use it
  if (type.toInput !== undefined) {
    return type.toInput(block);
  }

  // Otherwise, fall back to using toFields and wrap the result
  return { fields: type.toFields(block) };
}

/**
 * Pads an array with a given value (or value generator) until it reaches the specified size.
 *
 * @template T The type of elements in the input array.
 * @param {T[]} array - The array to pad.
 * @param {number} size - The desired size after padding.
 * @param {T | (() => T)} value - The padding value or a function to generate it.
 * @returns {T[]} A new padded array.
 * @throws Will throw if the input array is already larger than the target size.
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/main/src/util.ts#L136
 */
function pad<T>(array: T[], size: number, value: T | (() => T)): T[] {
  assert(
    array.length <= size,
    `padding array of size ${array.length} larger than target size ${size}`
  );
  let cb: () => T =
    typeof value === 'function' ? (value as () => T) : () => value;
  return array.concat(Array.from({ length: size - array.length }, cb));
}

/**
 * Splits a UInt32 index into three hierarchical parts for addressing within a padded SHA-2 message.
 *
 * @param {UInt32} index - The index to split.
 * @returns {[Field, Field, Field]} A tuple representing [byteIndexInUInt32, uint32IndexInBlock, blockIndex].
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/dynamic/dynamic-sha2.ts#L239
 */
function splitMultiIndex(index: UInt32) {
  let { rest: l0, quotient: l1 } = index.divMod(64);
  let { rest: l00, quotient: l01 } = l0.divMod(4);
  return [l00.value, l01.value, l1.value] as const;
}

/**
 * Applies SHA-256 style padding to a dynamic-length byte array and chunks the result into 512-bit (64-byte) blocks.
 *
 * The padding scheme follows:
 * - Appending a single `0x80` byte
 * - Padding with `0x00` bytes to reach a length that is 8 bytes short of a multiple of 64
 * - Appending the original message length (in bits) as an 8-byte big-endian integer
 *
 * @param {DynamicArray<UInt8>} message - The message to pad, with dynamic length.
 * @returns {DynamicArray<StaticArray<UInt32>, bigint[]>} The padded message split into 16-UInt32 blocks.
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/dynamic/dynamic-sha2.ts#L172
 */
function padding256(
  message: DynamicArray<UInt8>
): DynamicArray<StaticArray<UInt32>, bigint[]> {
  /* padded message looks like this:
    
    M ... M 0x80 0x0 ... 0x0 L L L L L L L L
  
    where
    - M is the original message
    - the 8 L bytes encode the length of the original message, as a uint64
    - padding always starts with a 0x80 byte (= big-endian encoding of 1)
    - there are k 0x0 bytes, where k is the smallest number such that
      the padded length (in bytes) is a multiple of 64
  
    Corollaries:
    - the entire L section is always contained at the end of the last block
    - the 0x80 byte might be in the last block or the one before that
    - max number of blocks = ceil((M.maxLength + 9) / 64) 
    - number of actual blocks = ceil((M.length + 9) / 64) = floor((M.length + 9 + 63) / 64) = floor((M.length + 8) / 64) + 1
    - block number of L section = floor((M.length + 8) / 64)
    - block number of 0x80 byte index = floor(M.length / 64)
    */

  // check that all message bytes beyond the actual length are 0, so that we get valid padding just by adding the 0x80 and L bytes
  // this step creates most of the constraint overhead of dynamic sha2, but seems unavoidable :/
  message.forEach((byte, isPadding) => {
    Provable.assertEqualIf(isPadding, UInt8, byte, UInt8.from(0));
  });

  // create blocks of 64 bytes each
  const maxBlocks = Math.ceil((message.maxLength + 9) / 64);
  const BlocksOfBytes = DynamicArray(BlockBytes, { maxLength: maxBlocks });

  // Get the block index and determine the number of blocks
  let lastBlockIndex = UInt32.Unsafe.fromField(message.length.add(8)).div(64);
  let numberOfBlocks = lastBlockIndex.value.add(1);

  // Apply padding
  let padded = pad(message.array, maxBlocks * 64, UInt8.from(0));
  // Split padded byte blocks to arrays of 64 bytes.
  let chunked = chunk(padded, 64).map(BlockBytes.from);
  let blocksOfBytes = new BlocksOfBytes(chunked, numberOfBlocks);

  // pack each block of 64 bytes into 16 uint32s (4 bytes each)
  let blocks = blocksOfBytes.map(Block32, (block) =>
    block.chunk(4).map(UInt32, (b) => UInt32.fromBytesBE(b.array))
  );

  // Splice the length in the same way
  // Length = byteIndex + 4 * integerIndex + 64 * blockIndexx
  // blockIndex is the block index, integerIndex is the uint32 index in the block, and byteIndex the byte index in the uint32
  let [byteIndex, integerIndex, blockIndex] = splitMultiIndex(
    UInt32.Unsafe.fromField(message.length)
  );

  // hierarchically get byte at `length` and set to 0x80
  // we can use unsafe get/set because the indices are in bounds by design
  let block = blocks.getOrUnconstrained(blockIndex);
  let wordBytes = WordBytes.from(
    block.getOrUnconstrained(integerIndex).toBytesBE()
  );

  wordBytes.setOrDoNothing(byteIndex, UInt8.from(0x80));
  block.setOrDoNothing(integerIndex, UInt32.fromBytesBE(wordBytes.array));
  blocks.setOrDoNothing(blockIndex, block);

  // set last 64 bits to encoded length (in bits, big-endian encoded)
  // in fact, since dynamic array asserts that length fits in 16 bits, we can set the second to last uint32 to 0
  let lastBlock = blocks.getOrUnconstrained(lastBlockIndex.value);
  lastBlock.set(14, UInt32.from(0));
  lastBlock.set(15, UInt32.Unsafe.fromField(message.length.mul(8))); // length in bits
  blocks.setOrDoNothing(lastBlockIndex.value, lastBlock);

  return blocks;
}

/**
 * Converts a `State32` object (an array of 8 UInt32 values) into a flat byte array in big-endian format.
 *
 * @param {State32} state - A `State32` object, which consists of an array of 8 `UInt32` values.
 * @returns {Bytes} A `Bytes` object representing the big-endian byte serialization of the state.
 */
function state32ToBytes(state: State32) {
  return Bytes.from(state.array.flatMap((x) => x.toBytesBE()));
}
