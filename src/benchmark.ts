import { Field, Provable } from 'o1js';
import { getQRData, TEST_DATA } from './getQRData.js';
import { createDelimitedData, createPaddedQRData } from './testUtils.js';
import { ageAndGenderExtractor, delimitData, photoExtractor, photoExtractorChunked, pincodeExtractor, stateExtractor, timestampExtractor } from './extractors.js';
import { getDelimiterIndices } from './utils.js';
import { PHOTO_POSITION } from './constants.js';
import { ConstraintSystemSummary } from 'o1js/dist/node/lib/provable/core/provable-context.js';

interface BenchmarkResults {
  methodName: string;
  rowSize: ConstraintSystemSummary;
}

const inputs = getQRData(TEST_DATA);
const qrDataPadded = inputs.paddedData.toBytes();
let qrData = createPaddedQRData(qrDataPadded);

// Get the photo index.

const delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field);
const photoIndex = delimiterIndices[PHOTO_POSITION - 1].add(1);
let nDelimitedData = createDelimitedData(qrData, Number(photoIndex)).map(Field);

async function getConstraints(
  fun: () => void
): Promise<ConstraintSystemSummary> {
  const constraints = await Provable.constraintSystem(() => fun());

  return constraints;
}

async function getBenchmarkParameters(
  methodName: string,
  fun: () => void
): Promise<BenchmarkResults> {
  const results = await getConstraints(fun);

  return {
    methodName: methodName,
    rowSize: results,
  };
}

/**
 * Start of benchmark for extractors.
 * Since they are functions to be used inside ZkProgram, computation
 * of constraints are done with `Provable.constraintSystem()`.
 */
function delimitDataConstraints() {
  const dataArray = Provable.witness(Provable.Array(Field, 1536), () =>
    qrData.map((x) => Field.from(x))
  );
  const photoIdx = Provable.witness(Field, () => photoIndex);

  // This throws error at the moment.
  delimitData(dataArray, photoIdx);
}

function timestampExtractorConstraints() {
  const dataArray = Provable.witness(Provable.Array(Field, 1536), () =>
    qrData.map((x) => Field.from(x))
  );

  timestampExtractor(dataArray);
}

function ageAndGenderExtractorConstraints() {
  const dataArray = Provable.witness(
    Provable.Array(Field, 1536),
    () => nDelimitedData
  );

  const indices = Provable.witness(
    Provable.Array(Field, 18),
    () => delimiterIndices
  );
  const day = Provable.witness(Field, () => Field.from(1));
  const month = Provable.witness(Field, () => Field.from(1));
  const year = Provable.witness(Field, () => Field.from(2024));

  ageAndGenderExtractor(dataArray, indices, year, month, day);
}

function pincodeExtractorConstraints(){
  const dataArray = Provable.witness(
    Provable.Array(Field, 1536),
    () => nDelimitedData
  );

  const indices = Provable.witness(
  Provable.Array(Field, 18),
  () => delimiterIndices
  );
  pincodeExtractor(dataArray, indices);
}

function stateExtractorConstraints(){
  const dataArray = Provable.witness(
    Provable.Array(Field, 1536),
    () => nDelimitedData
  );

  const indices = Provable.witness(
  Provable.Array(Field, 18),
  () => delimiterIndices
  );
  stateExtractor(dataArray, indices);
}

function chunkedPhotoExtractorConstraints(){
  const dataArray = Provable.witness(
    Provable.Array(Field, 1536),
    () => nDelimitedData
  );

  const indices = Provable.witness(
  Provable.Array(Field, 18),
  () => delimiterIndices
  );
  photoExtractor(dataArray, indices);
}


function photoExtractorConstraints(){
  const dataArray = Provable.witness(
    Provable.Array(Field, 1536),
    () => nDelimitedData
  );

  const indices = Provable.witness(
  Provable.Array(Field, 18),
  () => delimiterIndices
  );
  photoExtractorChunked(dataArray, indices);
}

// Parameters are assigned to a variable as `BenchmarkResults` type.
const delimitDataParameters = await getBenchmarkParameters(
  'Delimit Data',
  delimitDataConstraints
);

const ageAndGenderExtractorParameters = await getBenchmarkParameters(
  'Age and Gender',
  ageAndGenderExtractorConstraints
);

const timestampParameters = await getBenchmarkParameters(
  'Delimit Data',
  timestampExtractorConstraints
);

const pincodeExtractorParameters = await getBenchmarkParameters(
  'Pincode',
  pincodeExtractorConstraints
);


const stateExtractorParameters = await getBenchmarkParameters(
  'Pincode',
  stateExtractorConstraints
);


const photoExtractorParameters = await getBenchmarkParameters(
  'Pincode',
  photoExtractorConstraints
);

const chunkedPhotoExtractorParameters = await getBenchmarkParameters(
  'Pincode',
  chunkedPhotoExtractorConstraints
);
