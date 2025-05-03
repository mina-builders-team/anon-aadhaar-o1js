import { Field, Provable } from 'o1js';
import {
  DOB_POSITION,
  GENDER_POSITION,
  PHOTO_POSITION,
  PINCODE_POSITION,
} from './constants.js';
import { paddedData } from './data-utils.js';
import { DataExtractor, DelimiterExtractor } from './extractor.js';
import {
  getDelimiterIndices,
  createPaddedQRData,
  createDelimitedData,
} from './utils';

const proofsEnabled = false;

describe('Extractor circuit tests', () => {
  let nDelimitedData: Field[];
  let qrData: Field[];
  let delimiterIndices: Field[];

  beforeAll(async () => {
    await DelimiterExtractor.compile({ proofsEnabled });
    await DataExtractor.compile({ proofsEnabled });

    const qrDataPadded = paddedData.toBytes();

    delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field);
    qrData = createPaddedQRData(paddedData.toBytes());

    const photoIndex = delimiterIndices[PHOTO_POSITION - 1].add(1);
    nDelimitedData = createDelimitedData(qrData, photoIndex);
  }),
    describe('Delimiter circuit tests', () => {
      it('should extract delimited data correctly', async () => {
        const photoIndex = delimiterIndices[PHOTO_POSITION - 1].add(1);

        const proof1 = await DelimiterExtractor.extractData(qrData, photoIndex);

        const output1 = proof1.proof.publicOutput;

        expect(output1).toEqual(nDelimitedData);

        const summary = await DelimiterExtractor.analyzeMethods();
        console.log(summary);
      });
    });
  describe('Extractor Circuit tests', () => {
    it('should extract timestamp correct', async () => {
      const { proof } = await DataExtractor.timestamp(nDelimitedData);
      const output = proof.publicOutput;

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
        nDelimitedData,
        delimiterIndex,
        year,
        month,
        day
      );
      const output = proof.publicOutput;

      expect(output.toBigInt()).toEqual(BigInt(40));
    });
    it('should find gender', async () => {
      const genderIndex = delimiterIndices[GENDER_POSITION - 1].add(1);

      const { proof } = await DataExtractor.gender(nDelimitedData, genderIndex);

      console.log(proof.publicOutput.toBigInt());
      console.log(String.fromCharCode(Number(proof.publicOutput)) === 'M');
    });
    it('should get pincode ', async () => {
      const pincodeIndex = delimiterIndices[PINCODE_POSITION - 1].add(1);

      const { proof } = await DataExtractor.pincode(
        nDelimitedData,
        pincodeIndex
      );

      console.log(proof.publicOutput.toBigInt());
      console.log(proof.publicOutput.toBigInt() === 110051n);
    });
  });
});
