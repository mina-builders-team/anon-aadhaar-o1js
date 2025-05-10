import { assert, Bool, Field, Gadgets, Provable, UInt32 } from 'o1js';
import {
  digitBytesToInt,
  digitBytesToTimestamp,
  elementAtIndex,
} from './utils.js';
import {
  DOB_POSITION,
  MAX_FIELD_BYTE_SIZE,
  PINCODE_POSITION,
  STATE_POSITION,
} from './constants.js';
export {
  extractData,
  timestampExtractor,
  ageAndGenderExtractor,
  pincodeExtractor,
  stateExtractor,
};

function extractData(paddedData: Field[], photoIndex: Field) {
  let delimitedData = [];
  let n255Filter = Field.from(0);
  const twoFiftyFive = Field.from(255);

  let is255 = Field.from(0);
  let indexBeforePhoto = Field.from(0);
  let is255AndIndexBeforePhoto = Field.from(0);
  for (let i = 0; i < 1536; i++) {
    is255 = paddedData[i].equals(twoFiftyFive).toField();

    indexBeforePhoto = Field(i).lessThan(photoIndex).toField();
    is255AndIndexBeforePhoto = is255.mul(indexBeforePhoto);

    delimitedData[i] = is255AndIndexBeforePhoto
      .mul(n255Filter)
      .add(paddedData[i]);

    n255Filter = is255AndIndexBeforePhoto.mul(255).add(n255Filter);
  }

  return delimitedData;
}

function timestampExtractor(nDelimitedData: Field[]) {
  const year = digitBytesToInt(
    [
      nDelimitedData[9],
      nDelimitedData[10],
      nDelimitedData[11],
      nDelimitedData[12],
    ],
    4
  );

  const month = digitBytesToInt([nDelimitedData[13], nDelimitedData[14]], 2);

  const day = digitBytesToInt([nDelimitedData[15], nDelimitedData[16]], 2);

  const hour = digitBytesToInt([nDelimitedData[17], nDelimitedData[18]], 2);

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

  return timestamp;
}

function ageAndGenderExtractor(
  nDelimitedData: Field[],
  startDelimiterIndex: Field,
  currentYear: Field,
  currentMonth: Field,
  currentDay: Field
) {
  let ageData: Field[] = [];

  // Date consist of 12 characters including delimiters.
  for (let i = 0; i < 12; i++) {
    ageData.push(elementAtIndex(nDelimitedData, startDelimiterIndex.add(i)));
  }

  const years = digitBytesToInt(
    [ageData[7], ageData[8], ageData[9], ageData[10]],
    4
  );
  const months = digitBytesToInt([ageData[4], ageData[5]], 2);
  const days = digitBytesToInt([ageData[1], ageData[2]], 2);

  assert(ageData[0].equals(Field(DOB_POSITION * 255)));
  assert(ageData[11].equals(Field((DOB_POSITION + 1) * 255)));

  let gender = elementAtIndex(nDelimitedData, startDelimiterIndex.add(12));

  // Calculate age based on year
  const ageByYear = currentYear.sub(years).sub(Field(1));

  // Check if current month > DOB month or if same month and current day >= DOB day
  const monthGt = currentMonth.greaterThan(months).toField();
  const monthEq = currentMonth.equals(months).toField();
  const dayGt = currentDay.add(Field(1)).greaterThan(days).toField();
  const isHigherDayOnSameMonth = monthEq.mul(dayGt);

  // Final age calculation
  const age = ageByYear.add(monthGt.add(isHigherDayOnSameMonth));
  return [age, gender];
}

function pincodeExtractor(nDelimitedData: Field[], delimiterIndices: Field[]) {
  let pincodeArray = [];

  const startIndex = delimiterIndices[PINCODE_POSITION - 1].add(1);

  // Pincode size is fixed.
  for (let i = 0; i < 6; i++) {
    pincodeArray.push(Gadgets.arrayGet(nDelimitedData, startIndex.add(i)));
  }

  const pincode = digitBytesToInt(pincodeArray, 6);

  return pincode;
}

function stateExtractor(nDelimitedData: Field[], delimiterIndices: Field[]) {
  let stateArray = [];

  const byteLength = MAX_FIELD_BYTE_SIZE + 1;

  // start with first element.
  const startIndex = delimiterIndices[STATE_POSITION - 1].add(1);

  // Ending delimiter of the state.
  const endValue = (STATE_POSITION + 1) * 255;
  let is255 = Bool(false);
  for (let i = 0; i < byteLength; i++) {
    const pushValue = Gadgets.arrayGet(nDelimitedData, startIndex.add(i));

    is255 = Bool.or(is255, pushValue.equals(endValue));

    const toBePushed = Provable.if(is255.not(), pushValue, Field.from(0));

    stateArray.push(toBePushed);
  }

  return stateArray;
}
