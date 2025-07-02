import { StaticArray } from 'mina-attestations'
import { Bytes, MerkleList, Option, UInt32, UInt8 } from 'o1js'
import { commitBlock256 } from './utils.js'
export { WordBytes, BlockBytes, Block32, State32, Bytes32, MerkleBlocks }

/**
 * Represents an array of UInt32 of length 4.
 */
class WordBytes extends StaticArray(UInt8, 4) {}

/**
 * Represents an array of UInt8 of length 64.
 */
class BlockBytes extends StaticArray(UInt8, 64) {}

/**
 * Represents an array of UInt32 of length 16.
 */
class Block32 extends StaticArray(UInt32, 16) {}

/**
 * Represents an array of UInt32 of length 8.
 */
class State32 extends StaticArray(UInt32, 8) {}

/**
 * Represents a 32-byte array, typically used to hold SHA256 digest.
 */
class Bytes32 extends Bytes(32) {}

/**
 *
 * Merkelized list of SHA256 blocks, for passing them down a recursive program.
 *
 * @notice - Taken from https://github.com/zksecurity/mina-attestations/blob/835d8d47566c4c065fa34c88af7ce99a5993425c/src/email/zkemail.ts#L137
 */
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
    blocks = blocks.clone()
    let tail: Option<Block32>[] = Array(n)

    for (let i = n - 1; i >= 0; i--) {
      tail[i] = blocks.popOption()
    }
    return { remaining: blocks, tail }
  }
}
