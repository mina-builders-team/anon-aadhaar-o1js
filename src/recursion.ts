import {
  Experimental,
  Gadgets,
  MerkleList,
  Option,
  Proof,
  Provable,
  UInt32,
  ZkProgram,
} from 'o1js';
import { Block32, State32 } from './utils.js';
import { commitBlock256, hashBlock256, hashBlocks } from './utils.js';
export {
  MerkleBlocks,
  hashProgram,
  BLOCKS_PER_BASE_PROOF,
  BLOCKS_PER_RECURSIVE_PROOF,
  hashProgramRecursive,
};

// 9 is on the high end, leads to 47k constraints
// By changing the numbers, we can obtain less or more constraints.
const BLOCKS_PER_RECURSIVE_PROOF = 5;
const BLOCKS_PER_BASE_PROOF = 8;

class MerkleBlocks extends MerkleList.create(Block32, commitBlock256) {
  /**
   * Pop off `n` elements from the end of the Merkle list. The return values are:
   * - `remaining`: The new Merkle list with elements popped off (input list is not mutated)
   * - `tail`: The removed elements, in their original order.
   *   Since there might be less than `n` elements in the list, `tail` is an array of options.
   *
   * The method guarantees that pushing all the `Some` options back to `remaining` would result in the original list.
   */
  static popTail(
    blocks: MerkleBlocks,
    n: number
  ): { remaining: MerkleBlocks; tail: Option<Block32>[] } {
    blocks = blocks.clone();
    let tail: Option<Block32>[] = Array(n);

    for (let i = n - 1; i >= 0; i--) {
      tail[i] = blocks.popOption();
    }
    return { remaining: blocks, tail };
  }
}

const hashProgram = ZkProgram({
  name: 'recursive-hash',

  publicInput: MerkleBlocks,
  publicOutput: State32,

  methods: {
    // base method that starts hashing from the initial state and guarantees to process all input blocks
    hashBase: {
      privateInputs: [],
      async method(blocks: MerkleBlocks) {
        let state = State32.from(Gadgets.SHA2.initialState(256) as UInt32[]);

        blocks.forEach(BLOCKS_PER_BASE_PROOF, (block, isDummy) => {
          let nextState = hashBlock256(state, block);
          state = Provable.if(isDummy, State32, state, nextState);
        });
        return { publicOutput: state };
      },
    },

    // method that hashes recursively, handles arbitrarily many blocks
    hashRecursive: {
      privateInputs: [],
      async method(blocks: MerkleBlocks) {
        let state = await hashBlocks(blocks, {
          blocksInThisProof: BLOCKS_PER_RECURSIVE_PROOF,
        });
        return { publicOutput: state };
      },
    },
  },
});

const recursiveHashProgram = ZkProgram({
  name: 'header-and-body-hash',

  publicInput: MerkleBlocks,
  publicOutput: State32,

  methods: {
    run: {
      privateInputs: [],
      async method(blocks: MerkleBlocks) {
        // hash the header here, and the body recursively

        let currentState = await hashBlocks(blocks, {
          blocksInThisProof: 1,
        });
        return { publicOutput: currentState };
      },
    },
  },
});

let hashProgramRecursive = Experimental.Recursive(recursiveHashProgram);
