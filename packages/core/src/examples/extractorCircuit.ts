import { ZkProgram, Provable, Field, UInt32, Struct, verify } from 'o1js'
import {
  DATA_ARRAY_SIZE,
  DELIMITER_ARRAY_SIZE,
  PHOTO_POSITION,
} from '../constants.js'
import {
  delimitData,
  timestampExtractor,
  ageAndGenderExtractor,
  pincodeExtractor,
  stateExtractor,
} from '../extractors.js'
import { getQRData, TEST_DATA } from '../getQRData.js'
import { createPaddedQRData } from '../testUtils.js'
import { getDelimiterIndices } from '../utils.js'
import { nullifier } from '../nullifier.js'

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
        Provable.Array(Field, DELIMITER_ARRAY_SIZE),
        Field,
        Field,
        Field,
      ],
      async method(
        data: Field[],
        delimiterIndices: Field[],
        year: Field,
        month: Field,
        day: Field
      ) {
        const photoIndex = UInt32.Unsafe.fromField(
          delimiterIndices[PHOTO_POSITION - 1].add(1)
        )
        const nDelimitedData = delimitData(data, photoIndex)
        Provable.log('Data Delimited..')
        const timestamp = timestampExtractor(nDelimitedData)
        Provable.log('Timestamp Extracted..')
        const [age, gender] = ageAndGenderExtractor(
          nDelimitedData,
          delimiterIndices,
          year,
          month,
          day
        )
        Provable.log('Age and Gender Extracted..')
        const pincode = pincodeExtractor(nDelimitedData, delimiterIndices)
        Provable.log('Pincode Extracted..')
        const state = stateExtractor(nDelimitedData, delimiterIndices)
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

let delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field)

let qrData = createPaddedQRData(qrDataPadded).map(Field)
const day = Field.from(1)
const month = Field.from(1)
const year = Field.from(2024)
const { verificationKey } = await ExtractorCircuit.compile({
  proofsEnabled: true,
})

console.time('Proof generation time')
const { proof } = await ExtractorCircuit.extract(
  qrData,
  delimiterIndices,
  year,
  month,
  day
)
console.timeEnd('Proof generation timey')

const constraints = await ExtractorCircuit.analyzeMethods()
console.log(constraints.extract.summary())

await verify(proof, verificationKey)
