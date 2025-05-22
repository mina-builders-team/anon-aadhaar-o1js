import {
  Experimental,
  Gadgets,
  Proof,
  Provable,
  UInt32,
  ZkProgram,
} from 'o1js';
import { hashBlock256, hashBlocks } from './utils.js';
import { MerkleBlocks, State32 } from './dataTypes.js';
export {
  BLOCKS_PER_BASE_PROOF,
  BLOCKS_PER_RECURSIVE_PROOF,
  hashProgram,
  recursiveHashProgram,
  hashRecursive,
  RecursionProof,
  hashWrapper,
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
  name: 'recursive-hash',

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

let hashRecursive = Experimental.Recursive(recursiveHashProgram);

const hashWrapper = ZkProgram({
  name: 'hash-wrapper',

  publicInput: MerkleBlocks,
  publicOutput: State32,

  methods: {
    run: {
      privateInputs: [],
      async method(blocks: MerkleBlocks) {
        const state = await hashRecursive.run(blocks);

        return { publicOutput: state };
      },
    },
  },
});

class RecursionProof extends ZkProgram.Proof(hashWrapper) {}
