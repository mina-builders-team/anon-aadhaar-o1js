import { ZkProgram, Provable, Field, Struct, SelfProof } from 'o1js';
import {
  charBytesToInt,
  digitBytesToInt,
  digitBytesToTimestamp,
  elementAtIndex,
  findElementAndReturnInteger,
  selectSubarray,
} from './utils.js';

class ExtractorOutputs extends Struct({
  TimeStamp: Field,
  Age: Field,
  AgeAbove18: Field,
  Gender: Field,
  Pincode: Field,
  State: Provable.Array(Field, 24), // Extend for 24 character long state names.
  Photo: Provable.Array(Field, 992), // Photo is represented in an array of maximum size of PHOTO_PACK_SIZE * MAX_FIELD_BYTE_SIZE in big endian format
}) {}

/**
 * ZkProgram for extracting and delimiting padded 1536-length Field data blocks.
 * This program allows recursive processing of data chunks, tracking filtering
 * and indexing across recursive steps.
 *
 * Rows: 634,752
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
/**
 * Extraction of data from delimited data.
 *
 * @returns - A field element for obtaining data
 */
export const DataExtractor = ZkProgram({
  name: 'Extractor',
  publicOutput: ExtractorOutputs,

  methods: {
    /**
     *
     * Takes delimited data as an input and extracts timestamp , which is issued in IST timezone.
     *
     * Converts it to UNIX timestamp and returns it as a Field element.
     *
     */
    createBaseProof: {
      privateInputs: [],

      async method() {
        const stateArray = Array.from({ length: 24 }, () => Field(0));
        const photoArray = Array.from({ length: 32 }, () => Field(0));

        return {
          publicOutput: new ExtractorOutputs({
            TimeStamp: Field(0),
            Age: Field(0),
            AgeAbove18: Field(0),
            Gender: Field(0),
            Pincode: Field(0),
            State: stateArray,
            Photo: photoArray,
          }),
        };
      },
    },
    timestamp: {
      privateInputs: [SelfProof, Provable.Array(Field, 1536)],

      async method(
        earlierProof: SelfProof<unknown, ExtractorOutputs>,
        nDelimitedData: Field[]
      ) {
        earlierProof.verify();

        const year = digitBytesToInt(
          [
            nDelimitedData[9],
            nDelimitedData[10],
            nDelimitedData[11],
            nDelimitedData[12],
          ],
          4
        );

        const month = digitBytesToInt(
          [nDelimitedData[13], nDelimitedData[14]],
          2
        );

        const day = digitBytesToInt(
          [nDelimitedData[15], nDelimitedData[16]],
          2
        );

        const hour = digitBytesToInt(
          [nDelimitedData[17], nDelimitedData[18]],
          2
        );

        // Convert to Unix timestamp
        const unixTime = digitBytesToTimestamp(
          year,
          month,
          day,
          hour,
          Field(0),
          Field(0),
          2032
        );

        // Adjust for IST time zone (-19800 seconds)
        const timestamp = unixTime.sub(Field(19800));

        return {
          publicOutput: new ExtractorOutputs({
            ...earlierProof.publicOutput,
            TimeStamp: timestamp,
          }),
        };
      },
    },
    age: {
      privateInputs: [
        SelfProof,
        Provable.Array(Field, 1536),
        Field,
        Field,
        Field,
        Field,
      ],
      async method(
        earlierProof: SelfProof<unknown, ExtractorOutputs>,
        nDelimitedData: Field[],
        startDelimiterIndex: Field,
        currentYear: Field,
        currentMonth: Field,
        currentDay: Field
      ) {
        earlierProof.verify();
        const year = findElementAndReturnInteger(
          nDelimitedData,
          startDelimiterIndex,
          4,
          7
        );
        const month = findElementAndReturnInteger(
          nDelimitedData,
          startDelimiterIndex,
          2,
          4
        );
        const day = findElementAndReturnInteger(
          nDelimitedData,
          startDelimiterIndex,
          2,
          1
        );

        // Calculate age based on year
        const ageByYear = currentYear.sub(year).sub(Field(1));

        // Check if current month > DOB month or if same month and current day >= DOB day
        const monthGt = currentMonth.greaterThan(month).toField();
        const monthEq = currentMonth.equals(month).toField();
        const dayGt = currentDay.add(Field(1)).greaterThan(day).toField();
        const isHigherDayOnSameMonth = monthEq.mul(dayGt);

        // Final age calculation
        const age = ageByYear.add(monthGt.add(isHigherDayOnSameMonth));
        const isAbove18 = age.greaterThan(18).toField();
        return {
          publicOutput: new ExtractorOutputs({
            ...earlierProof.publicOutput,
            Age: age,
            AgeAbove18: isAbove18,
          }),
        };
      },
    },
    gender: {
      privateInputs: [Provable.Array(Field, 1536), Field],

      async method(nDelimitedData: Field[], startDelimiterIndex: Field) {
        // No special order index needed.
        const gender = elementAtIndex(nDelimitedData, startDelimiterIndex);
        return { publicOutput: gender };
      },
    },

    pincode: {
      privateInputs: [Provable.Array(Field, 1536), Field],
      async method(nDelimitedData: Field[], startIndex: Field) {
        const selectedArray = selectSubarray(nDelimitedData, startIndex, 6);
        const pincode = digitBytesToInt(selectedArray, 6);

        return { publicOutput: pincode };
      },
    },
    state: {
      privateInputs: [Provable.Array(Field, 1536), Field, Field],
      async method(nDelimitedData: Field[], startIndex: Field, length: Field) {
        const selectedSubArr = selectSubarray(nDelimitedData, startIndex, 5);

        const state = charBytesToInt(selectedSubArr, 5);
        return { publicOutput: state };
      },
    },
  },
});
