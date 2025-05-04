import { Field } from 'o1js';
import {
  DOB_POSITION,
  GENDER_POSITION,
  PHOTO_POSITION,
  PINCODE_POSITION,
  STATE_POSITION,
} from './constants.js';
import {
  DataExtractor,
  DelimiterExtractor,
  DataExtractorProof,
} from './extractor.js';
import {
  getDelimiterIndices,
  createPaddedQRData,
  createDelimitedData,
  intToCharString,
} from './utils.js';
import { getQRData, TEST_DATA } from './getQRData.js';

const proofsEnabled = false;

describe('Extractor circuit tests', () => {
  let nDelimitedData: Field[];
  let qrData: Field[];
  let delimiterIndices: Field[];
  let lastProof: DataExtractorProof;

  beforeAll(async () => {
    await DelimiterExtractor.compile({ proofsEnabled });
    await DataExtractor.compile({ proofsEnabled });

    const inputs = getQRData(TEST_DATA);
    const qrDataPadded = inputs.paddedData.toBytes();

    delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field);
    qrData = createPaddedQRData(inputs.paddedData.toBytes());

    const photoIndex = delimiterIndices[PHOTO_POSITION - 1].add(1);
    nDelimitedData = createDelimitedData(qrData, photoIndex);

    lastProof = (await DataExtractor.createBaseProof()).proof;
  }),
    describe('Delimiter circuit tests', () => {
      it('should extract delimited data correctly', async () => {
        const photoIndex = delimiterIndices[PHOTO_POSITION - 1].add(1);

        const proof1 = await DelimiterExtractor.extractData(qrData, photoIndex);
        const delimitedData = proof1.proof.publicOutput;

        expect(delimitedData).toEqual(nDelimitedData);

        const summary = await DelimiterExtractor.analyzeMethods();
        console.log(summary);
      });
    });
  describe('Extractor Circuit tests', () => {
    it('should extract timestamp correct', async () => {
      const { proof } = await DataExtractor.timestamp(
        lastProof,
        nDelimitedData
      );
      const output = proof.publicOutput.TimeStamp;

      const date = new Date(Number(output) * 1000).getTime();

      const expectedDate = new Date('2024-04-19T19:30:00.000Z').getTime();

      expect(date).toEqual(expectedDate);
    });
    it('should extract age correct', async () => {
      const day = Field.from(1);
      const month = Field.from(1);
      const year = Field.from(2024);
      const delimiterIndex = delimiterIndices[DOB_POSITION - 1];

      const { proof } = await DataExtractor.age(
        lastProof,
        nDelimitedData,
        delimiterIndex,
        year,
        month,
        day
      );
      const outputAge = proof.publicOutput.Age;
      const outputAgeAbove18 = proof.publicOutput.AgeAbove18;
      expect(outputAge.toBigInt()).toEqual(40n);
      expect(outputAgeAbove18.toBigInt()).toEqual(1n);
    });
    it('should find gender', async () => {
      const genderIndex = delimiterIndices[GENDER_POSITION - 1].add(1);

      const { proof } = await DataExtractor.gender(
        lastProof,
        nDelimitedData,
        genderIndex
      );  

      const outputGender = proof.publicOutput.Gender;

      expect(String.fromCharCode(Number(outputGender))).toEqual('M');
    });
    it('should get pincode ', async () => {
      const pincodeIndex = delimiterIndices[PINCODE_POSITION - 1].add(1);

      const { proof } = await DataExtractor.pincode(
        lastProof,
        nDelimitedData,
        pincodeIndex
      );

      const outputPincode = proof.publicOutput.Pincode;

      expect(outputPincode.toBigInt()).toEqual(110051n);
    });
    it('should extract state', async () => {
      const stateLength = delimiterIndices[STATE_POSITION].sub(
        delimiterIndices[STATE_POSITION - 1]
      );

      const stateIndex = delimiterIndices[STATE_POSITION - 1].add(1);

      const { proof } = await DataExtractor.state(
        lastProof,
        nDelimitedData,
        stateIndex,
      );

      // Get the first array, which is the selected subarray
      const outputState = proof.publicOutput.State[0];

      expect(intToCharString(outputState, 5)).toEqual('Delhi');
    });
  });
});
