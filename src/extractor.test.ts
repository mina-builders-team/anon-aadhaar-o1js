import { Field, Provable } from 'o1js';
import { PHOTO_POSITION } from './constants.js';
import { paddedData } from './data-utils.js';
import { DelimiterExtractor } from './extractor.js';
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
});
