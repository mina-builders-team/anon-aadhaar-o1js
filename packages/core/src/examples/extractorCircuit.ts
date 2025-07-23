import { ZkProgram, Provable, Field, Struct, verify } from 'o1js'
import { DATA_ARRAY_SIZE } from '../constants.js'
import {
  delimitData,
  timestampExtractor,
  ageAndGenderExtractor,
  pincodeExtractor,
  stateExtractor,
} from '../helpers/extractors.js'
import { getQRData, TEST_DATA } from '../getQRData.js'
import { createPaddedQRData } from '../../tests/testUtils.js'
import { nullifier } from '../helpers/nullifier.js'

class ExtractorOutputs extends Struct({
  Timestamp: Field,
  Age: Field,
  Gender: Field,
  Pincode: Field,
  State: Provable.Array(Field, 16),
  nullifiedValue: Field,
}) {}

const ExtractorCircuit = ZkProgram({
  name: 'test-program',
  publicOutput: ExtractorOutputs,

  methods: {
    extract: {
      privateInputs: [
        Provable.Array(Field, DATA_ARRAY_SIZE),
        Field,
        Field,
        Field,
      ],
      async method(
        data: Field[],
        year: Field,
        month: Field,
        day: Field
      ) {
        const nDelimitedData = delimitData(data)
        Provable.log('Data Delimited..')
        const timestamp = timestampExtractor(nDelimitedData)
        Provable.log('Timestamp Extracted..')
        const [age, gender] = ageAndGenderExtractor(
          nDelimitedData,
          year,
          month,
          day
        )
        Provable.log('Age and Gender Extracted..')
        const pincode = pincodeExtractor(nDelimitedData)
        Provable.log('Pincode Extracted..')
        const state = stateExtractor(nDelimitedData)
        Provable.log('State Extracted..')

        // This can/should be given as an input to the circuit.
        const nullifierSeed = Field.from(123124124214)

        const nullifiedValue = nullifier(nDelimitedData, nullifierSeed)
        Provable.log('Nullifier Computed..')
        return {
          publicOutput: new ExtractorOutputs({
            Timestamp: timestamp,
            Age: age,
            Gender: gender,
            Pincode: pincode,
            State: state,
            nullifiedValue: nullifiedValue,
          }),
        }
      },
    },
  },
})

const inputs = getQRData(TEST_DATA)
const qrDataPadded = inputs.paddedData.toBytes()


const qrData = createPaddedQRData(qrDataPadded).map(Field)
const day = Field.from(1)
const month = Field.from(1)
const year = Field.from(2024)
const { verificationKey } = await ExtractorCircuit.compile({
  proofsEnabled: true,
})

console.time('Proof generation time')
const { proof } = await ExtractorCircuit.extract(
  qrData,
  year,
  month,
  day
)
console.timeEnd('Proof generation time')

const constraints = await ExtractorCircuit.analyzeMethods()
console.log(constraints.extract.summary())

await verify(proof, verificationKey)
