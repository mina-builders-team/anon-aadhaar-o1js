import {
  Bool,
  Bytes,
  Experimental,
  Field,
  Gadgets,
  Provable,
  Struct,
  UInt32,
  ZkProgram,
} from 'o1js';
import { Block32, MerkleBlocks, State32 } from './dataTypes.js';
import { getQRData, TEST_DATA } from './getQRData.js';

import { generateMessageBlocks, state32ToBytes } from './utils.js';

class DataBlocks extends Struct({
  data: Provable.Array(Block32, 2),
}) {
  getBlockAt(idx: Field): Block32 {
    let result = this.data[0];

    for (let i = 0; i < 2; i++) {
      const isIdx = idx.equals(Field.from(i));
      result = Provable.if(isIdx, Block32, this.data[i], result);
    }
    return result;
  }
}

/**
 * Recursive hash that processes blocks in correct order
 */
const hashProgram = ZkProgram({
  name: 'recursive-hashing',
  publicOutput: State32,
  methods: {
    hashStep: {
      privateInputs: [DataBlocks, State32, Field, Field],
      async method(
        blocks: DataBlocks,
        currentState: State32,
        remainingBlocks: Field,
        currentIndex: Field
      ) {
        let shouldRecurse = Bool(false);

        const currentBlock = blocks.getBlockAt(currentIndex);

        const nextState = hashBlock256(currentState, currentBlock);

        const newRemainingBlocks = remainingBlocks.sub(Field.from(1));
        const nextIndex = currentIndex.add(Field.from(1));

        shouldRecurse = newRemainingBlocks.greaterThan(Field.from(0));

        const recursiveResult: State32 = nextState
          // await recursiveHash.hashStep.if(
          //   shouldRecurse,
          //   blocks,
          //   nextState,
          //   newRemainingBlocks,
          //   nextIndex
          // );

        // Return the appropriate result
        const output = Provable.if(
          shouldRecurse,
          State32,
          recursiveResult,
          nextState
        );

        return {
          publicOutput: output,
        };
      },
    },
  },
});

let recursiveHash = Experimental.Recursive(hashProgram);

async function testRecursiveHash() {
  const testData = getQRData(TEST_DATA).signedData;
  let paddedBlocks = Gadgets.SHA2.padding(256, testData.slice(0, 100));
  let paddedData = Bytes.from(
    paddedBlocks
      .flat()
      .map((word) => word.toBytesBE())
      .flat()
  );

  const msgBlocks: Block32[] = generateMessageBlocks(paddedData).map((arr) =>
    Block32.from(arr)
  );

  let dataBlocks = new DataBlocks({
    data: msgBlocks,
  });

  // Compile the program
  await hashProgram.compile({ proofsEnabled: true });

  // Initial SHA-256 state
  const initialValue: UInt32[] = Gadgets.SHA2.initialState(256);
  const initState = State32.from(initialValue);

  // Test with first 2 blocks
  const numBlocks = 2;

  // Recursive hashing
  console.log('\n=== Recursive Hashing ===');
  const recursiveResult = await hashProgram.hashStep(
    dataBlocks,
    initState,
    Field.from(numBlocks),
    Field.from(0)
  );

  // Compare results
  const recursiveHash = state32ToBytes(recursiveResult.proof.publicOutput).toHex();
  const expectedHash = Gadgets.SHA2.hash(256, testData.slice(0, 100)).toHex();

  console.log('\n=== Results ===');
  console.log('Recursive hash:', recursiveHash);
  console.log('Expected hash: ', expectedHash);
  console.log('Match:', recursiveHash === expectedHash);
}

/**
 * Computes the SHA-256 hash of a block using a given initial state.
 */
function hashBlock256(state: State32, block: Block32): State32 {
  let W = Gadgets.SHA2.messageSchedule(256, block.array);
  return State32.from(Gadgets.SHA2.compression(256, state.array, W));
}

// Run the test
testRecursiveHash().catch(console.error);
