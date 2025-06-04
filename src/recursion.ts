import {
  Experimental,
  Gadgets,
  Proof,
  Provable,
  UInt32,
  ZkProgram,
} from 'o1js';
import { Block32, MerkleBlocks, State32 } from './dataTypes.js';
export {
  BLOCKS_PER_BASE_PROOF,
  BLOCKS_PER_RECURSIVE_PROOF,
  hashProgram,
  hashProgramWrapper,
  recursiveHash,
  hashBlocks,
  hashBlock256,
};

// 9 is on the high end, leads to 47k constraints
// By changing the numbers, we can obtain less or more constraints.
const BLOCKS_PER_RECURSIVE_PROOF = 5;
const BLOCKS_PER_BASE_PROOF = 8;

const hashProgram = ZkProgram({
  name: 'hash-program',

  publicInput: MerkleBlocks,
  publicOutput: State32,

  methods: {
    // Base method that starts hashing from the initial state and guarantees to process all input blocks
    hashBase: {
      privateInputs: [],
      async method(blocks: MerkleBlocks) {
        let state = State32.from(Gadgets.SHA2.initialState(256) as UInt32[]);

        // Apply hash to each block. After hashing, state is updated conditionally if the hashing process is done with a non-dummy block.
        blocks.forEach(BLOCKS_PER_BASE_PROOF, (block, isDummy) => {
          let nextState = hashBlock256(state, block);
          state = Provable.if(isDummy, State32, state, nextState);
        });
        return { publicOutput: state };
      },
    },

    // Method that hashes recursively, handles arbitrarily many blocks
    hashRecursive: {
      privateInputs: [],
      async method(blocks: MerkleBlocks) {
        let state = await hashBlocks(blocks, BLOCKS_PER_RECURSIVE_PROOF);
        return { publicOutput: state };
      },
    },
  },
});

/**
 * A hash wrapper that can be used to get the output of hashBlocks along with a zk proof.
 * hashBlocks can be used directly in any circuit - this wrapper method will wrap the output to a proof.
 *
 * @param {MerkleBlocks} blocks - The full array of Merkle blocks to hash.
 * @returns {Proof} - Proof that contains the resulting hash after hashing all the blocks.
 */
const hashProgramWrapper = ZkProgram({
  name: 'recursive-hash',

  publicInput: MerkleBlocks,
  publicOutput: State32,

  methods: {
    run: {
      privateInputs: [],
      async method(blocks: MerkleBlocks) {
        let currentState = await hashBlocks(blocks, BLOCKS_PER_RECURSIVE_PROOF);
        return { publicOutput: currentState };
      },
    },
  },
});

let recursiveHash = Experimental.Recursive(hashProgramWrapper);

  /**
   * Recursively hashes a sequence of Merkle blocks using a proof system.
   *
   * This function splits the input blocks into two parts:
   * - A "tail" of blocks to be hashed directly.
   * - A "remaining" prefix to be hashed recursively or using a base method.
   *
   * The result is a SHA-256 style hash after applying all block transformations.
   *
   * @param {MerkleBlocks} blocks - The full array of Merkle blocks to hash.
   * @param {{ blocksInThisProof: number }} options - The number of blocks to include in the current proof.
   * @returns {Promise<State32>} The resulting state after hashing all blocks.
   * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/email/zkemail.ts#L210
   */
  async function hashBlocks(
    blocks: MerkleBlocks,
    numberOfBlocks: number
  ): Promise<State32> {
    // Popping `numberOfBlocks` amount of blocks from the MerkleBlocks
    let { remaining, tail } = MerkleBlocks.popTail(blocks, numberOfBlocks);

    // Apply recursive hashing in witness blocks. Later on, remanining MerkleBlock's hash commitment can be checked with the recursionProof's output to see if correct blocks are used.
    let recursionProof = await Provable.witnessAsync(
      hashProgram.Proof,
      async () => {
        // convert the blocks to constants
        let blocksForProof = Provable.toConstant(MerkleBlocks, remaining.clone());

        // If remaining blocks of recursive approach is less than a threshold (BLOCKS_PER_BASE_PROOF), a base hashing is applied.
        let remainingBlocks = remaining.lengthUnconstrained().get();

        // Define the proof variable that will be returned.
        let proof: Proof<MerkleBlocks, State32>;

        // Choose which hashing method will be used depending on the remainingBlocks.
        if (remainingBlocks <= BLOCKS_PER_BASE_PROOF) {
          ({ proof } = await hashProgram.hashBase(blocksForProof));
        } else {
          ({ proof } = await hashProgram.hashRecursive(blocksForProof));
        }
        return proof;
      }
    );

  // Use declare method to verify proof inside of ZkProgram as if it was an input to the circuit.
  recursionProof.declare();
  recursionProof.verify();

  // Constrain public input to match the remaining blocks
  remaining.hash.assertEquals(recursionProof.publicInput.hash);

  // Continue hashing the final part
  let state = recursionProof.publicOutput;

  // Apply hashing to every existing block. Blocks are returned as Option<Block32>, where it has a Bool 'isSome' indicates if there is a block in iterated element.
  // isSome is used for reassigning the state with the updated hash
  tail.forEach(({ isSome, value: block }) => {
    let nextState = hashBlock256(state, block);
    state = Provable.if(isSome, State32, nextState, state);
  });
  return state;
}

/**
 * Computes the SHA-256 hash of a block using a given initial state.
 *
 * @param {State32} state - The initial SHA-256 state (8 UInt32s).
 * @param {Block32} block - The message block to hash (16 UInt32s).
 * @returns {State32} The new SHA-256 state after compression.
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/main/src/dynamic/dynamic-sha2.ts#L511
 */
function hashBlock256(state: State32, block: Block32): State32 {
  let W = Gadgets.SHA2.messageSchedule(256, block.array);
  return State32.from(Gadgets.SHA2.compression(256, state.array, W));
}
