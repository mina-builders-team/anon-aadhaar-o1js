import { Bytes, Field, Gadgets, UInt32 } from 'o1js'
import { calculatePaddedDataHash } from '../src/helpers/paddedDataHash.js'
import { commitBlock256, padding256 } from '../src/utils.js'
import { Block32 } from '../src/helpers/dataTypes.js'
import { DynamicBytes } from 'mina-attestations'
import { createPaddedQRData } from './testUtils.js'


describe('calculatePaddedDataHash', () => {
  it('computes hash of padded data consistently with MerkleBlocks.hash', () => {
    const data = [1, 2, 3, 4, 5]
    const dynamicData = DynamicBytes.from(data)
    const dynamicDataPadded = padding256(dynamicData)
    const merkleBlocks = dynamicDataPadded.merkelize(commitBlock256)
    const expectedHash = merkleBlocks.hash
    console.log(`dynamicDataPadded: ${dynamicDataPadded.get(UInt32.from(0)).array.map((b) => b.toString())}`)

    const paddedData = Gadgets.SHA2.padding(256, new Uint8Array(data)).flat().map((word) => word.toBytesBE()).flat()
    const hash = calculatePaddedDataHash(createPaddedQRData(Bytes.from(paddedData).toBytes()).map((b) => Field(b)))
    console.log(`expected: ${expectedHash.toString()}`)
    console.log(`hash: ${hash.toString()}`)
    expect(hash.toString()).toEqual(expectedHash.toString())
  })
})


