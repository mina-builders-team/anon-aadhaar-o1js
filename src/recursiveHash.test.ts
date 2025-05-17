import { Bytes, Gadgets, UInt32 } from 'o1js';
import { getQRData, TEST_DATA } from './getQRData.js';
import {
  prepareRecursiveHashData,
} from './testUtils.js';
import { hashProgram, hashRecursive, recursiveHashProgram } from './recursion.js';

let proofsEnabled = false;

describe('Recursive Hash tests', () => {
  let initialValue: UInt32[];
  let paddedData: Bytes;
  
  let signedData: Uint8Array;

  beforeAll(async () => {
    await hashProgram.compile({proofsEnabled});
    await recursiveHashProgram.compile({proofsEnabled});

    const inputs = getQRData(TEST_DATA);

    paddedData = inputs.paddedData;
    initialValue = inputs.initialValue;
    signedData = inputs.signedData;
  });

  describe('Partial hashing computations', () => {
    it('should compute recursive hash with abstracted hashing', async () => {
      const blocks = prepareRecursiveHashData(signedData);

      const digest = await hashRecursive.run(blocks);

      const finalDigest = Bytes.from(
        digest.array.flatMap((x) => x.toBytesBE())
      );

      const expectedDigest = Gadgets.SHA2.hash(256, signedData);
      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    })
    it('should return correct hash for a single block', async () => {
      const singleBlockData = signedData.slice(0, 64); // or appropriate block size
      const blocks = prepareRecursiveHashData(singleBlockData);
    
      const digest = await hashRecursive.run(blocks);
      const finalDigest = Bytes.from(digest.array.flatMap((x) => x.toBytesBE()));
      const expectedDigest = Gadgets.SHA2.hash(256, singleBlockData);
    
      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    });
  });
});
