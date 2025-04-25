import {
  Provable,
  UInt32,
  ZkProgram,
  Bytes,
  Struct,
  SelfProof,
  Field,
} from 'o1js';
import { pkcs1v15Pad, updateHash } from './utils';
import { wordToBytes } from './utils';
import { Bigint2048, rsaVerify65537 } from './rsa';

/**
 * Represents a 512-byte array, used for SHA256 block-wise hashing.
 */
class Bytes512 extends Bytes(512) {}

/**
 * Represents a 128-byte array, used for recursive smaller block hashing.
 */
class Bytes128 extends Bytes(128) {}

/**
 * Represents a 32-byte array, typically used to hold SHA256 digest.
 */
class Bytes32 extends Bytes(32) {}

/**
 * Structure holding the SHA256 state (digest) calculated so far as an array of 8 UInt32s.
 */
class HashOutputs extends Struct({
  hashState: Provable.Array(UInt32, 8),
}) {}

export const SignatureVerifier = ZkProgram({
  name: 'SignatureVerifier',
  publicOutput: HashOutputs,

  methods: {
    /**
     * Performs the initial SHA256 hash on a 512-byte preimage.
     * @param preimage - First 512-byte chunk of the message.
     * @param initialHashValues - Initial hash state (SHA256 IV).
     * @returns The hash state after processing the first block.
     */
    baseCase: {
      privateInputs: [Bytes512.provable, Provable.Array(UInt32, 8)],

      async method(preimage: Bytes512, initialHashValues: UInt32[]) {
        const hashResults = updateHash(initialHashValues, preimage);
        return {
          publicOutput: new HashOutputs({
            hashState: hashResults.hashState,
          }),
        };
      },
    },

    /**
     * Performs the initial SHA256 hash on a 128-byte preimage.
     * @param preimage - First 128-byte chunk of the message.
     * @param initialHashValues - Initial hash state (SHA256 IV).
     * @returns The hash state after processing the block.
     */
    baseCase128: {
      privateInputs: [Bytes128.provable, Provable.Array(UInt32, 8)],

      async method(preimage: Bytes128, initialHashValues: UInt32[]) {
        const hashResults = updateHash(initialHashValues, preimage);
        return {
          publicOutput: new HashOutputs({
            hashState: hashResults.hashState,
          }),
        };
      },
    },

    /**
     * Continues hashing with a new 512-byte chunk using the hash state from the previous proof.
     * @param earlierProof - The previous recursive proof with hash state.
     * @param preimage - The next 512-byte padded chunk of the message.
     * @returns Updated hash state after processing this chunk.
     */
    hashStep: {
      privateInputs: [SelfProof, Bytes512.provable],

      async method(
        earlierProof: SelfProof<unknown, HashOutputs>,
        preimage: Bytes512
      ) {
        earlierProof.verify();
        const prevHashFinalState = earlierProof.publicOutput.hashState;

        const hashResults = updateHash(prevHashFinalState, preimage);

        return {
          publicOutput: new HashOutputs({
            hashState: hashResults.hashState,
          }),
        };
      },
    },

    /**
     * Continues hashing with a new 128-byte chunk using the hash state from the previous proof.
     * @param earlierProof - The previous recursive proof with hash state.
     * @param preimage - The next 128-byte padded chunk of the message.
     * @returns Updated hash state after processing this chunk.
     */
    hashStep128: {
      privateInputs: [SelfProof, Bytes128.provable],

      async method(
        earlierProof: SelfProof<unknown, HashOutputs>,
        preimage: Bytes128
      ) {
        earlierProof.verify();
        const prevHashFinalState = earlierProof.publicOutput.hashState;

        const hashResults = updateHash(prevHashFinalState, preimage);

        return {
          publicOutput: new HashOutputs({
            hashState: hashResults.hashState,
          }),
        };
      },
    },

    /**
     * Verifies RSA-65537 signature of a SHA256 digest using a given public key.
     * Converts the final hash state to a byte array, applies PKCS#1 v1.5 padding,
     * and then verifies against the provided RSA signature.
     *
     * @param earlierProof - The final proof of recursive hashing.
     * @param signature - RSA signature of the message.
     * @param publicKey - RSA-2048 public key used to verify the signature.
     * @returns Outputs the final hash state if signature verification passes.
     */
    verifySignature: {
      privateInputs: [SelfProof, Bigint2048, Bigint2048],

      async method(
        earlierProof: SelfProof<unknown, HashOutputs>,
        signature: Bigint2048,
        publicKey: Bigint2048
      ) {
        earlierProof.verify();
        const hashState = earlierProof.publicOutput.hashState;

        const finalHash = Bytes32.from(
          hashState.map((x) => wordToBytes(x.value, 4, true)).flat()
        );

        const paddedHash = pkcs1v15Pad(finalHash);

        rsaVerify65537(paddedHash, signature, publicKey);

        return {
          publicOutput: new HashOutputs({
            hashState,
          }),
        };
      },
    },
  },
});
