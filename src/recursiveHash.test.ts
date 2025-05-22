import { Gadgets } from 'o1js';
import { getQRData, TEST_DATA } from './getQRData.js';
import { generateHashFromData } from './testUtils.js';
import {
  hashProgram,
  hashProgramWrapper,
} from './recursion.js';

let proofsEnabled = true;

describe('Recursive Hash tests', () => {
  let signedData: Uint8Array;

  beforeAll(async () => {
    await hashProgram.compile({ proofsEnabled });
    await hashProgramWrapper.compile({ proofsEnabled });

    const inputs = getQRData(TEST_DATA);

    signedData = inputs.signedData;
  });

  describe('Recursive hashing computations', () => {
    it('should compute recursive hash with abstracted hashing', async () => {
      const finalDigest = await generateHashFromData(signedData);

      const expectedDigest = Gadgets.SHA2.hash(256, signedData);
      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    });
    it('should return correct hash for a single block', async () => {
      const singleBlockData = signedData.slice(0, 64); // or appropriate block size

      const finalDigest = await generateHashFromData(singleBlockData);

      const expectedDigest = Gadgets.SHA2.hash(256, singleBlockData);

      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    });
    it('should correctly hash data not aligned to block size', async () => {
      const weirdLengthData = signedData.slice(0, 45); // Example: not divisible by 64
      const finalDigest = await generateHashFromData(weirdLengthData);

      const expectedDigest = Gadgets.SHA2.hash(256, weirdLengthData);

      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    });
  });
});
