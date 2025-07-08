import { assert, Bool, Field, Provable, UInt32 } from 'o1js'
import {
  digitBytesToInt,
  digitBytesToTimestamp,
  searchElement,
} from './utils.js'
import {
  DATA_ARRAY_SIZE,
  DELIMITER_POSITION
} from './constants.js'
export {
  delimitData,
  timestampExtractor,
  ageAndGenderExtractor,
  pincodeExtractor,
  stateExtractor,
}

/**
 * Processes the padded data up to the photo index, applying a 255 delimiter filter.
 * Returns a new array where elements before the photo are conditionally zeroed or kept.
 *
 * Rows: 10753
 *
 * @param {Field[]} paddedData - The input data array, padded with extra values.
 * @param {Field} photoIndex - The index marking where photo data begins.
 * @returns {Field[]} The delimited and filtered data array.
 */
function delimitData(paddedData: Field[], photoIndex: UInt32) {
  const delimitedData = []
  let n255Filter = Field.from(0)

  for (let i = 0; i < DATA_ARRAY_SIZE; i++) {
    const is255AndIndexBeforePhoto = Bool.and(
      paddedData[i].equals(255),
      UInt32.from(i).lessThan(photoIndex)
    )

    const n255FilterDelta = Provable.if(
      is255AndIndexBeforePhoto,
      Field(1),
      Field(0)
    )

    const dataDelta = Provable.if(
      is255AndIndexBeforePhoto,
      n255Filter,
      Field(0)
    )

    n255Filter = n255Filter.seal()
    delimitedData[i] = paddedData[i].add(dataDelta.mul(255))
    n255Filter = n255Filter.add(n255FilterDelta)
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
 * Rows: 10051
 *
 * @param {Field[]} nDelimitedData - The delimited input data array.
 * @param {Field[]} delimiterIndices - Array of indices marking field positions.
 * @param {Field} currentYear - Current year as a Field.
 * @param {Field} currentMonth - Current month as a Field.
 * @param {Field} currentDay - Current day as a Field.
 * @returns {[Field, Field]} A tuple: [calculated age, extracted gender].
 */
function ageAndGenderExtractor(
  nDelimitedData: Field[],
  delimiterIndices: Field[],
  currentYear: Field,
  currentMonth: Field,
  currentDay: Field
) {
  const ageData: Field[] = []
  const startIndex = delimiterIndices[DELIMITER_POSITION.DOB - 1]
  // Date consist of 12 characters including delimiters.
  for (let i = 0; i < 12; i++) {
    const currentIndex = startIndex.add(i)
    // Soft assumption: data we search will be placed in less than 256th index.

    const agePushValue = searchElement(nDelimitedData, currentIndex, 256)

    ageData.push(agePushValue)
  }
  const years = digitBytesToInt(
    [ageData[7], ageData[8], ageData[9], ageData[10]],
    4
  )

  const months = digitBytesToInt([ageData[4], ageData[5]], 2)
  const days = digitBytesToInt([ageData[1], ageData[2]], 2)

  assert(ageData[0].equals(Field(DELIMITER_POSITION.DOB * 255)))
  assert(ageData[11].equals(Field((DELIMITER_POSITION.DOB + 1) * 255)))

  const genderIndex = startIndex.add(12)
  const gender = searchElement(nDelimitedData, genderIndex, 256)

  // Calculate age based on year
  const ageByYear = currentYear.sub(years).sub(Field(1))

  // Check if current month > DOB month or if same month and current day >= DOB day
  const monthGt = currentMonth.greaterThan(months).toField()
  const monthEq = currentMonth.equals(months).toField()
  const dayGt = currentDay.add(Field(1)).greaterThan(days).toField()
  const isHigherDayOnSameMonth = monthEq.mul(dayGt)

  // Final age calculation
  const age = ageByYear.add(monthGt.add(isHigherDayOnSameMonth))
  return [age, gender]
}

/**
 * Extracts the fixed-length 6-digit pincode from delimited data.
 *
 * Rows: 4599
 *
 * @param {Field[]} nDelimitedData - The delimited input data array.
 * @param {Field[]} delimiterIndices - Array of indices marking field positions.
 * @returns {Field} The extracted pincode as an integer Field.
 */
function pincodeExtractor(nDelimitedData: Field[], delimiterIndices: Field[]) {
  const startIndex = delimiterIndices[DELIMITER_POSITION.PINCODE- 1].add(1)

  const pincodeArray = []

  for (let i = 0; i < 6; i++) {
    const currentIndex = startIndex.add(i)

    const pushval = searchElement(nDelimitedData, currentIndex, 256)
    pincodeArray.push(pushval)
  }
  const pincode = digitBytesToInt(pincodeArray, 6)

  return pincode
}

/**
 * Extracts the state information from delimited data until it hits the next delimiter.
 *
 * Rows: 12328
 *
 * @param {Field[]} nDelimitedData - The delimited input data array.
 * @param {Field[]} delimiterIndices - Array of indices marking field positions.
 * @returns {Field[]} An array representing the extracted state data.
 */
function stateExtractor(nDelimitedData: Field[], delimiterIndices: Field[]) {
  const startIndex = delimiterIndices[DELIMITER_POSITION.STATE - 1].add(1)

  const stateArray = []

  // Ending delimiter of the state.
  const endValue = (DELIMITER_POSITION.STATE + 1) * 255
  let is255 = Bool(false)

  for (let i = 0; i < 16; i++) {
    let pushValue = Field.from(0)

    const currentIndex = startIndex.add(i)
    // Under assumption that state data will be at most <256th byte.
    for (let j = 0; j < 256; j++) {
      const isIndex = currentIndex.equals(j).toField()
      const isValue = isIndex.mul(nDelimitedData[j])

      pushValue = pushValue.seal()
      pushValue = pushValue.add(isValue)
    }

    is255 = Bool.or(is255, pushValue.equals(endValue))

    const toBePushed = Provable.if(is255.not(), pushValue, Field.from(0))

    stateArray.push(toBePushed)
  }

  return stateArray
}
