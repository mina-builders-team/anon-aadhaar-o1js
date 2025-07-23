import { Field, UInt32 } from 'o1js'
import { DELIMITER_POSITION } from './constants.js'
import { getDelimiterIndices } from './utils.js'
import { getQRData, TEST_DATA } from './getQRData.js'
import {
  ageAndGenderExtractor,
  delimitData,
  pincodeExtractor,
  stateExtractor,
  timestampExtractor,
} from './extractors.js'
import {
  createDelimitedData,
  intToCharString,
  charBytesToInt,
  createPaddedQRData,
} from './testUtils.js'
import { nullifier } from './nullifier.js'

describe('Extractor circuit tests', () => {
  let nDelimitedData: Field[]
  let qrData: number[]
  let photoIndex: UInt32

  beforeAll(async () => {
    const inputs = getQRData(TEST_DATA)
    const qrDataPadded = inputs.paddedData.toBytes()

    const delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field)

    qrData = createPaddedQRData(qrDataPadded)

    photoIndex = UInt32.Unsafe.fromField(
      delimiterIndices[DELIMITER_POSITION.PHOTO - 1].add(1)
    )
    // Map to field for using it through tests.
    nDelimitedData = createDelimitedData(qrData, Number(photoIndex)).map(Field)
  })

  describe('getDelimiterIndices utility function', () => {
    it('should extract delimiter indices correctly', async () => {
      const inputs = getQRData(TEST_DATA)
      const qrDataPadded = inputs.paddedData.toBytes()
      const indices = getDelimiterIndices(qrDataPadded)
      expect(indices.length).toEqual(18)
      expect(qrDataPadded[indices[DELIMITER_POSITION.PHOTO - 1]]).toEqual(255)
      expect(qrDataPadded[indices[DELIMITER_POSITION.NAME - 1]]).toEqual(255)
    })
  })

  describe('Delimiter circuit tests', () => {
    it('should extract delimited data correctly', async () => {
      const qrDataField = qrData.map(Field)

      const nDelimitedDataFromCircuit = delimitData(qrDataField)
      expect(nDelimitedDataFromCircuit).toEqual(nDelimitedData)
    })
  })

  describe('Timestamp Extractor Circuit tests', () => {
    it('should extract timestamp correctly', async () => {
      const timestamp = timestampExtractor(nDelimitedData)

      const date = new Date(Number(timestamp) * 1000).getTime()

      const expectedDate = new Date('2024-04-19T19:30:00.000Z').getTime()

      expect(date).toEqual(expectedDate)
    })
  })

  describe('Age and Gender Extractor Circuit tests', () => {
    it('should extract age and gender correctly', async () => {
      const day = Field.from(1)
      const month = Field.from(1)
      const year = Field.from(2024)

      const [age, gender] = ageAndGenderExtractor(nDelimitedData, year, month, day)

      expect(age.toBigInt()).toEqual(40n)
      expect(String.fromCharCode(Number(gender))).toEqual('M')
    })
  })

  describe('Pincode Extractor Circuit tests', () => {
    it('should get pincode ', async () => {
      const pincode = pincodeExtractor(nDelimitedData)
      expect(pincode.toBigInt()).toEqual(110051n)
    })
  })

  describe('State Extractor Circuit tests', () => {
    it('should extract state', async () => {
      const state = stateExtractor(nDelimitedData)
      // Our state here is at length 5, so try:
      const stateValue = charBytesToInt(state.slice(0, 5), 5)
      expect(intToCharString(stateValue, 5)).toEqual('Delhi')
      // the remaining bytes should be zero
      expect(state.slice(5).every((x) => x.equals(Field(0)))).toBeTruthy()
    })
  })

  describe('Nullifier Circuit tests', () => {
    it('should compute nullifier correctly', async () => {
      const nullifierSeed = Field(12345678)
      const nullifierHash = nullifier(nDelimitedData, nullifierSeed)
      console.log(nullifierHash.value)
    })
  })
})
