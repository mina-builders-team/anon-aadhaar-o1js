import { Bytes, Gadgets, UInt32 } from 'o1js';
import { RecursiveHash } from './recursiveHash.js';
import { getQRData, TEST_DATA } from './getQRData.js';
import {
  compute512BasedHashDigest,
  computeChained128HashDigest,
} from './testUtils.js';

let proofsEnabled = false;

describe('Recursive Hash tests', () => {
  let initialValue: UInt32[];
  let paddedData: Bytes;

  let signedData: Uint8Array;

  beforeAll(async () => {
    await RecursiveHash.compile({ proofsEnabled });

    const inputs = getQRData(TEST_DATA);

    paddedData = inputs.paddedData;
    initialValue = inputs.initialValue;
    signedData = inputs.signedData;
  });

  describe('Partial hashing computations', () => {
    // Warning: This step tests 128-byte hashing with 9 chunks, which is computationally heavier than other tests, so it takes more time to complete.
    // It is executed only when proofsEnabled = true.
    (!proofsEnabled ? it.skip : it)(
      'should compute partial hashing with 9 byte blocks of size 128 bytes.',
      async () => {
        // Now split at your desired boundaries (multiple of 64 bytes)
        const finalDigest = await computeChained128HashDigest(
          paddedData,
          initialValue
        );

        const expectedDigest = Gadgets.SHA2.hash(256, signedData);
        expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
      }
    );

    it('should compute partial hashing with byte blocks split by 512-512-128.', async () => {
      const finalDigest = await compute512BasedHashDigest(
        paddedData,
        initialValue
      );

      const expectedDigest = Gadgets.SHA2.hash(256, signedData);
      expect(finalDigest.toHex()).toEqual(expectedDigest.toHex());
    });

    it('should output different digest with wrong initial values', async () => {
      const wrongInitialValue: UInt32[] = Gadgets.SHA2.initialState(224);

      const finalDigest = await compute512BasedHashDigest(
        paddedData,
        wrongInitialValue
      );

      const expectedDigest = Gadgets.SHA2.hash(256, signedData);
      expect(finalDigest.toHex()).not.toEqual(expectedDigest.toHex());
    });
  });
});
