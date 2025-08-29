import { assert, Bool, Field, Provable} from 'o1js'
import {
  digitBytesToInt,
  digitBytesToTimestamp,
  searchElement,
  selectSubarray,
} from '../utils.js'
import {
  DATA_ARRAY_SIZE,
  DELIMITER_POSITION
} from '../constants.js'
export {
  delimitData,
  timestampExtractor,
  dobAndGenderExtractor,
  pincodeExtractor,
  stateExtractor,
}

/**
 * Processes the padded data up to the photo index with each delimiter replaced by n * 255
 * where n means the nth occurrence of 255
 *
 * Rows: 10749
 *
 * @param {Field[]} paddedData - The input data array, padded with extra values.
 * @returns {Field[]} The delimited data array.
 */
function delimitData(paddedData: Field[]) {
  const delimitedData = []
  let counter = Field.from(0);
  let photoIndexReached = Bool(false);

  for (let i = 0; i < DATA_ARRAY_SIZE; i++) {
    const is255 = paddedData[i].equals(255)
    const dataDelta = Provable.if(
      is255.and(photoIndexReached.not()),
      counter.mul(255),
      Field(0)
    )

    counter = counter.seal()
    delimitedData[i] = paddedData[i].add(dataDelta)
    counter = counter.add(is255.toField())
    photoIndexReached = Bool.or(photoIndexReached, counter.equals(DELIMITER_POSITION.PHOTO))
  }

  return delimitedData
}

/**
 * Extracts the timestamp fields (year, month, day, hour) from delimited data
 * and converts them to a Unix timestamp adjusted for IST time zone.
 *
 * Rows: 953
 *
 * @param {Field[]} nDelimitedData - The delimited input data array.
 * @returns {Field} The calculated Unix timestamp.
 */
function timestampExtractor(nDelimitedData: Field[]) {
  const year = digitBytesToInt(
    [
      nDelimitedData[9],
      nDelimitedData[10],
      nDelimitedData[11],
      nDelimitedData[12],
    ],
    4
  )

  const month = digitBytesToInt([nDelimitedData[13], nDelimitedData[14]], 2)

  const day = digitBytesToInt([nDelimitedData[15], nDelimitedData[16]], 2)

  const hour = digitBytesToInt([nDelimitedData[17], nDelimitedData[18]], 2)

  // Convert to Unix timestamp
  const unixTime = digitBytesToTimestamp(
    year,
    month,
    day,
    hour,
    Field(0),
    Field(0),
    2032
  )

  // Adjust for IST time zone (-19800 seconds)
  const timestamp = unixTime.sub(Field(19800))

  return timestamp
}

/**
 * Extracts date of birth and gender information from delimited data,
 * calculates the person’s current age based on the current date.
 *
 * Rows: 9416
 *
 * @param {Field[]} nDelimitedData - The delimited input data array.
 * @returns {[Field, Field]} A tuple: [calculated age, extracted gender].
 */
function dobAndGenderExtractor(nDelimitedData: Field[]) {
  const ageData: Field[] = []
  const startIndex = Provable.witness(Field, () => {
    return  nDelimitedData.findIndex((value) => value.toBigInt() === BigInt(DELIMITER_POSITION.DOB * 255))
  })
  startIndex.assertGreaterThanOrEqual(0);
  startIndex.assertLessThanOrEqual(DATA_ARRAY_SIZE);
  // Date consist of 12 characters including delimiters.
  for (let i = 0; i < 12; i++) {
    const currentIndex = startIndex.add(i)
    // Soft assumption: data we search will be placed in less than 256th index.
    const agePushValue = searchElement(nDelimitedData, currentIndex, 256)
    ageData.push(agePushValue)
  }
  const dobYear = digitBytesToInt(
    [ageData[7], ageData[8], ageData[9], ageData[10]],
    4
  )

  const dobMonth = digitBytesToInt([ageData[4], ageData[5]], 2)
  const dobDay = digitBytesToInt([ageData[1], ageData[2]], 2)

  assert(ageData[0].equals(Field(DELIMITER_POSITION.DOB * 255)))
  assert(ageData[11].equals(Field((DELIMITER_POSITION.DOB + 1) * 255)))

  const genderIndex = startIndex.add(12)
  const gender = searchElement(nDelimitedData, genderIndex, 256)

  return [dobDay, dobMonth, dobYear, gender]
}

/**
 * Extracts the fixed-length 6-digit pincode from delimited data.
 *
 * Rows: 4606
 *
 * @param {Field[]} nDelimitedData - The delimited input data array.
 * @returns {Field} The extracted pincode as an integer Field.
 */
function pincodeExtractor(nDelimitedData: Field[]) {
  // startIndex is the index of delimiter
  const startIndex = Provable.witness(Field, () => {
    return nDelimitedData.findIndex((value) => value.toBigInt() === BigInt(DELIMITER_POSITION.PINCODE * 255))
  })
  startIndex.assertGreaterThanOrEqual(0);
  startIndex.assertLessThanOrEqual(DATA_ARRAY_SIZE);

  const pincodeArray: Field[] = []

  for (let i = 0; i < 7; i++) {
    const currentIndex = startIndex.add(i)

    const pushval = searchElement(nDelimitedData, currentIndex, 256)
    pincodeArray.push(pushval)
  }
  assert(pincodeArray[0].equals(Field(DELIMITER_POSITION.PINCODE * 255)))
  const pincode = digitBytesToInt(pincodeArray.slice(1, 7), 6)

  return pincode
}

/**
 * Extracts the state information from delimited data until it hits the next delimiter.
 *
 * Rows: 9406
 *
 * @param {Field[]} nDelimitedData - The delimited input data array.
 * @returns {Field[]} An array representing the extracted state data.
 */
function stateExtractor(nDelimitedData: Field[]) {
  const startIndex = Provable.witness(Field, () => {
    return nDelimitedData.findIndex((value) => value.toBigInt() === BigInt(DELIMITER_POSITION.STATE * 255))
  })
  startIndex.assertGreaterThanOrEqual(0);
  startIndex.assertLessThanOrEqual(DATA_ARRAY_SIZE);
  // Under assumption that state data will be at most <256th byte and under 16 bytes.
  const stateArray = selectSubarray(nDelimitedData.slice(0, 256), startIndex, 18)
  assert(stateArray[0].equals(DELIMITER_POSITION.STATE * 255));
  // convert bytes after stateData to zero
  const endValue = (DELIMITER_POSITION.STATE + 1) * 255;
  let isEndReached = Bool(false);
  for (let i = 0; i < 18; i++) {
    isEndReached = Bool.or(isEndReached, stateArray[i].equals(endValue))
    stateArray[i] = Provable.if(isEndReached.not(), stateArray[i], Field(0))
  }

  return stateArray.slice(1,18)
}
