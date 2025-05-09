import {
  Provable,
  UInt32,
  ZkProgram,
  Bytes,
  Struct,
  SelfProof,
  Field,
} from 'o1js';
import { pkcs1v15Pad, updateHash } from './utils.js';
import { Bigint2048, rsaVerify65537 } from './rsa.js';
export { SignatureVerifier };

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

const SignatureVerifier = ZkProgram({
  name: 'SignatureVerifier',
  publicOutput: HashOutputs,

  methods: {
    /**
     * Verifies RSA-65537 signature of a SHA256 digest using a given public key.
     * Rows : 12510
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

        const finalHash = Bytes32.from(hashState.flatMap((x) => x.toBytesBE()));

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
