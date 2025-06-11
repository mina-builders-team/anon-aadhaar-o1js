import { Field, Provable } from 'o1js';
import { getQRData, TEST_DATA } from './getQRData.js';
import { createPaddedQRData } from './testUtils.js';
import { delimitData } from './extractors.js';
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

// Parameters are assigned to a variable as `BenchmarkResults` type.
const delimitDataParameters = await getBenchmarkParameters(
  'Delimit Data',
  delimitDataConstraints
);
