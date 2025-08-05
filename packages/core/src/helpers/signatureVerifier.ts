import { ZkProgram, Field } from 'o1js'
import { pkcs1v15Pad, state32ToBytes } from '../utils.js'
import { Bigint2048, rsaVerify65537 } from './rsa.js'
import { BLOCKS_PER_RECURSIVE_PROOF, hashBlocks } from './sha256Hash.js'
import { MerkleBlocks } from './dataTypes.js'
export { SignatureVerifier }

const SignatureVerifier = ZkProgram({
  name: 'SignatureVerifier',
  publicInput: MerkleBlocks,

  methods: {
    /**
     * Verifies RSA-65537 signature of a SHA256 digest using a given public key.
     * Rows : 12510
     * Converts the final hash state to a byte array, applies PKCS#1 v1.5 padding,
     * and then verifies against the provided RSA signature.
     *
     * @param hashProof - The final proof of recursive hashing.
     * @param signature - RSA signature of the message.
     * @param publicKey - RSA-2048 public key used to verify the signature.
     * @returns Outputs the final hash state if signature verification passes.
     */
    verifySignature: {
      privateInputs: [Bigint2048, Bigint2048],

      async method(
        blocks: MerkleBlocks,
        signature: Bigint2048,
        publicKey: Bigint2048
      ) {
        const hashState = await hashBlocks(blocks, BLOCKS_PER_RECURSIVE_PROOF)

        const finalHash = state32ToBytes(hashState)

        const paddedHash = pkcs1v15Pad(finalHash)

        rsaVerify65537(paddedHash, signature, publicKey)
      },
    },
  },
})
