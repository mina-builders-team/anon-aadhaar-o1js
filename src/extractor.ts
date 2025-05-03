import { ZkProgram, Provable, Field } from 'o1js';

/**
 * ZkProgram for extracting and delimiting padded 1536-length Field data blocks.
 * This program allows recursive processing of data chunks, tracking filtering
 * and indexing across recursive steps.
 */
export const DelimiterExtractor = ZkProgram({
  name: 'DelimiterExtractor',
  publicOutput: Provable.Array(Field, 1536),

  methods: {
    extractData: {
      privateInputs: [Provable.Array(Field, 1536), Field],

      async method(data: Field[], idx: Field) {
        let n255Filter = Field.from(0);
        const twoFiftyFive = Field.from(255);

        let is255 = Field.from(0);
        let indexBeforePhoto = Field.from(0);
        let is255AndIndexBeforePhoto = Field.from(0);
        for (let i = 0; i < 1536; i++) {
          is255 = data[i].equals(twoFiftyFive).toField();

          indexBeforePhoto = Field(i).lessThan(idx).toField();
          is255AndIndexBeforePhoto = is255.mul(indexBeforePhoto);

          n255Filter = is255AndIndexBeforePhoto.mul(255).add(n255Filter);

          data[i] = is255AndIndexBeforePhoto.mul(n255Filter).add(data[i]);
        }

        return { publicOutput: data };
      },
    },
  },
});
