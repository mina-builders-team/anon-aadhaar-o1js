import { Field, Poseidon } from 'o1js'
import { chunk } from './utils.js'
export { nullifier }

function nullifier(nDelimitedData: Field[], nullifierSeed: Field) {
  let chunkedData = chunk(nDelimitedData, 32)
  let packedData = []
  let sum = Field(0)
  for (let i = 0; i < 48; i++) {
    chunkedData[i].forEach((chunk, i) => {
      sum = sum.add(chunk.mul(1n << BigInt(i * 32)))
    })

    packedData.push(sum)
    sum = Field.from(0)
    sum = sum.seal()
  }

  const hashPacked = Poseidon.hash(packedData)

  return Poseidon.hash([nullifierSeed, hashPacked])
}
