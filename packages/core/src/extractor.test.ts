import { Field, Poseidon, UInt32 } from 'o1js';
import {
  MAX_FIELD_BYTE_SIZE,
  PHOTO_PACK_SIZE,
  PHOTO_POSITION,
} from './constants.js';
import { getDelimiterIndices } from './utils.js';
import { getQRData, TEST_DATA } from './getQRData.js';
import {
  ageAndGenderExtractor,
  delimitData,
  pincodeExtractor,
  stateExtractor,
  timestampExtractor,
  photoExtractor,
  photoExtractorChunked,
} from './extractors.js';
import {
  createDelimitedData,
  intToCharString,
  charBytesToInt,
  createPaddedQRData,
} from './testUtils.js';
import { nullifier } from './nullifier.js';

describe('Extractor circuit tests', () => {
  let nDelimitedData: Field[];
  let qrData: number[];
  let delimiterIndices: Field[];
  let photoIndex: UInt32;

  beforeAll(async () => {
    const inputs = getQRData(TEST_DATA);
    const qrDataPadded = inputs.paddedData.toBytes();

    delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field);

    qrData = createPaddedQRData(qrDataPadded);

    photoIndex = UInt32.Unsafe.fromField(
      delimiterIndices[PHOTO_POSITION - 1].add(1)
    );
    // Map to field for using it through tests.
    nDelimitedData = createDelimitedData(qrData, Number(photoIndex)).map(Field);
  });

  describe('Delimiter circuit tests', () => {
    it('should extract delimited data correctly', async () => {
      const qrDataField = qrData.map(Field);

      const delimitedData = delimitData(qrDataField, photoIndex);

      expect(delimitedData).toEqual(nDelimitedData);
    });
  });
  describe('Extractor Circuit tests', () => {
    it('should extract timestamp correctly', async () => {
      const timestamp = timestampExtractor(nDelimitedData);

      const date = new Date(Number(timestamp) * 1000).getTime();

      const expectedDate = new Date('2024-04-19T19:30:00.000Z').getTime();

      expect(date).toEqual(expectedDate);
    });
    it('should extract age and gender correctly', async () => {
      const day = Field.from(1);
      const month = Field.from(1);
      const year = Field.from(2024);

      const [age, gender] = ageAndGenderExtractor(
        nDelimitedData,
        delimiterIndices,
        year,
        month,
        day
      );

      expect(age.toBigInt()).toEqual(40n);
      expect(String.fromCharCode(Number(gender))).toEqual('M');
    });
    it('should get pincode ', async () => {
      const pincode = pincodeExtractor(nDelimitedData, delimiterIndices);

      expect(pincode.toBigInt()).toEqual(110051n);
    });
    it('should extract state', async () => {
      const state = stateExtractor(nDelimitedData, delimiterIndices);

      // Our state here is at length 5, so try:
      const stateValue = charBytesToInt(state.slice(0, 5), 5);

      expect(intToCharString(stateValue, 5)).toEqual('Delhi');
    });
    it('should extract photo', async () => {
      const photoBytes = photoExtractor(nDelimitedData, delimiterIndices);

      // we know photo bytes start at 185.
      const byteLength = MAX_FIELD_BYTE_SIZE * PHOTO_PACK_SIZE;
      const startIndex = Number(delimiterIndices[PHOTO_POSITION - 1]);
      // Start with startIndex + 1 to omit the delimiter
      const slicedPhotoBytes = qrData.slice(
        startIndex + 1,
        startIndex + byteLength + 1
      );
      // Our state here is at length 5, so try:
      expect(photoBytes.toString()).toEqual(slicedPhotoBytes.toString());
    });
    it('should compute nullifier correctly', async () => {
    const nullifierSeed = Field(12345678);
    
    const photoBytes = photoExtractor(nDelimitedData, delimiterIndices);

    const nullifierHash = nullifier(nullifierSeed, photoBytes)
    const photoHash = Poseidon.hash(photoBytes);
    const nullifierOffCircuit = Poseidon.hash([nullifierSeed, photoHash]);

    expect(nullifierHash).toEqual(nullifierOffCircuit);

  })


  });
});
