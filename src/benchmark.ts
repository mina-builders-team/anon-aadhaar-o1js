import { Field, Provable } from 'o1js';
import { getQRData, TEST_DATA } from './getQRData.js';
import {
  createDelimitedData,
  createPaddedQRData,
  prepareRecursiveHashData,
} from './testUtils.js';
import {
  ageAndGenderExtractor,
  delimitData,
  photoExtractor,
  photoExtractorChunked,
  pincodeExtractor,
  stateExtractor,
  timestampExtractor,
} from './extractors.js';
import { getDelimiterIndices } from './utils.js';
import { PHOTO_POSITION } from './constants.js';
import { ConstraintSystemSummary } from 'o1js/dist/node/lib/provable/core/provable-context.js';
import { SignatureVerifier } from './signatureVerifier.js';
import { hashProgram } from './recursion.js';
import { nullifier } from './nullifier.js';

interface BenchmarkResults {
  methodName: string;
  rowSize: ConstraintSystemSummary;
}

// Proof Generation Configuration
let proofsEnabled = false;
let forceRecompile = true;

// Input Preparation
const inputs = getQRData(TEST_DATA);
const qrDataPadded = inputs.paddedData.toBytes();
const signature = inputs.signatureBigint;
const publicKey = inputs.publicKeyBigint;
const qrData = createPaddedQRData(qrDataPadded);
const delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field);

// Witnessed values
const photoIndex = Provable.witness(Field, () =>
  delimiterIndices[PHOTO_POSITION - 1].add(1)
);
const nDelimitedData = createDelimitedData(qrData, Number(photoIndex)).map(
  Field
);
const delimitedDataArray = Provable.witness(
  Provable.Array(Field, 1536),
  () => nDelimitedData
);
const indices = Provable.witness(
  Provable.Array(Field, 18),
  () => delimiterIndices
);
const dataArray = Provable.witness(Provable.Array(Field, 1536), () =>
  qrData.map((x) => Field.from(x))
);

async function getBenchmarkParameters(
  methodName: string,
  fun: () => void
): Promise<BenchmarkResults> {
  const constraints = await Provable.constraintSystem(() => fun());
  return {
    methodName: methodName,
    rowSize: constraints,
  };
}

/**
 * Start of benchmark for extractors.
 * Since they are functions to be used inside ZkProgram, computation
 * of constraints are done with `Provable.constraintSystem()`.
 */
function delimitDataConstraints() {
  delimitData(dataArray, photoIndex);
}

function timestampExtractorConstraints() {
  timestampExtractor(dataArray);
}

function ageAndGenderExtractorConstraints() {
  const day = Provable.witness(Field, () => Field.from(1));
  const month = Provable.witness(Field, () => Field.from(1));
  const year = Provable.witness(Field, () => Field.from(2024));

  ageAndGenderExtractor(delimitedDataArray, indices, year, month, day);
}

function pincodeExtractorConstraints() {
  pincodeExtractor(delimitedDataArray, indices);
}

function stateExtractorConstraints() {
  stateExtractor(delimitedDataArray, indices);
}

function chunkedPhotoExtractorConstraints() {
  photoExtractor(delimitedDataArray, indices);
}

function photoExtractorConstraints() {
  photoExtractorChunked(delimitedDataArray, indices);
}

// Parameters are assigned to relevant variables as `BenchmarkResults` type.
const delimitDataParameters = await getBenchmarkParameters(
  'Delimit Data',
  delimitDataConstraints
);

const ageAndGenderExtractorParameters = await getBenchmarkParameters(
  'Age and Gender',
  ageAndGenderExtractorConstraints
);

const timestampParameters = await getBenchmarkParameters(
  'Timestamp',
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