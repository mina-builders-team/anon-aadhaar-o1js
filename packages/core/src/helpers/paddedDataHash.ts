import { Field, Provable, UInt32 } from "o1js"
import { Block32 } from "./dataTypes.js"
import { chunk, commitBlock256 } from "../utils.js"

/**
 * Calculates the hash of the padded data, Such that it is matches with the MerkleBlocks.hash
 * @param data - data with sha256 padding
 * @returns hash of the padded data
 */
export function calculatePaddedDataHash(data: Field[]) {
    const uint32s: UInt32[] = chunk(data, 4).map((chunk) => {
        let sum = chunk[0]
        for(let i = 1; i < 4; i++) {
            sum = sum.mul(256).add(chunk[i])
        }
        return UInt32.fromFields([sum])
    })
    const blocks = chunk(uint32s, 16)
    const endBlockNumber = Provable.witness(UInt32, () => {
        // count the number of zero blocks from the end
        let count = 0
        for (let i = blocks.length - 1; i >= 0; i--) {
            if (blocks[i].every((x) => x.toBigint() === 0n)) {
                count++
            } else {
                break
            }
        }
        return UInt32.from(blocks.length - count)
    })
    let hashState = Field(0)
    for (let i = 0; i < blocks.length; i++) {
        hashState = Provable.if(
            UInt32.from(i).lessThan(endBlockNumber), 
            commitBlock256(hashState, Block32.from(blocks[i])), 
            hashState
        )
    }
    return hashState
}