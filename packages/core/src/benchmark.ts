import { Field, Provable } from 'o1js'
import { getQRData, TEST_DATA } from './getQRData.js'
import {
  createDelimitedData,
  createPaddedQRData,
  prepareRecursiveHashData,
} from '../tests/testUtils.js'
import {
  dobAndGenderExtractor,
  delimitData,
  pincodeExtractor,
  stateExtractor,
  timestampExtractor,
} from './helpers/extractors.js'
import { getDelimiterIndices } from './utils.js'
import {
  DELIMITER_POSITION,
  DATA_ARRAY_SIZE,
} from './constants.js'
import { ConstraintSystemSummary } from 'o1js/dist/node/lib/provable/core/provable-context.js'
import { SignatureVerifier } from './helpers/signatureVerifier.js'
import { hashProgram } from './helpers/sha256Hash.js'
import { AadhaarVerifier } from './AadhaarVerifier.js'
import { calculatePaddedDataHash } from './helpers/paddedDataHash.js'

interface BenchmarkResults {
  methodName: string
  rowSize: ConstraintSystemSummary
}

// Input Preparation
const inputs = getQRData(TEST_DATA)
const qrDataPadded = inputs.paddedData.toBytes()
const qrData = createPaddedQRData(qrDataPadded)
const delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field)

// Witnessed values
const photo = delimiterIndices[DELIMITER_POSITION.PHOTO - 1].add(1)
const nDelimitedData = createDelimitedData(qrData, Number(photo)).map(Field)

async function getBenchmarkParameters(
  methodName: string,
  fun: () => void
): Promise<BenchmarkResults> {
  const constraints = await Provable.constraintSystem(() => fun())
  return {
    methodName: methodName,
    rowSize: constraints,
  }
}

/**
 * Start of benchmark for extractors.
 * Since they are functions to be used inside ZkProgram, computation
 * of constraints are done with Provable.constraintSystem().
 */
function delimitDataConstraints() {
  const dataArray = Provable.witness(
    Provable.Array(Field, DATA_ARRAY_SIZE),
    () => qrData.map((x) => Field.from(x))
  )

  delimitData(dataArray)
}

function timestampExtractorConstraints() {
  const dataArray = Provable.witness(
    Provable.Array(Field, DATA_ARRAY_SIZE),
    () => qrData.map((x) => Field.from(x))
  )

  timestampExtractor(dataArray)
}

function dobAndGenderExtractorConstraints() {
  const delimitedDataArray = Provable.witness(
    Provable.Array(Field, DATA_ARRAY_SIZE),
    () => nDelimitedData
  )

  dobAndGenderExtractor(delimitedDataArray)
}

function pincodeExtractorConstraints() {
  const delimitedDataArray = Provable.witness(
    Provable.Array(Field, DATA_ARRAY_SIZE),
    () => nDelimitedData
  )

  pincodeExtractor(delimitedDataArray)
}

function stateExtractorConstraints() {
  const delimitedDataArray = Provable.witness(
    Provable.Array(Field, DATA_ARRAY_SIZE),
    () => nDelimitedData
  )

  stateExtractor(delimitedDataArray)
}

// Parameters are assigned to relevant variables as BenchmarkResults type.
const delimitDataParameters = await getBenchmarkParameters(
  'Delimit Data',
  delimitDataConstraints
)

const dobAndGenderExtractorParameters = await getBenchmarkParameters(
  'DOB and Gender',
  dobAndGenderExtractorConstraints
)

const timestampParameters = await getBenchmarkParameters(
  'Timestamp',
  timestampExtractorConstraints
)

const pincodeExtractorParameters = await getBenchmarkParameters(
  'Pincode',
  pincodeExtractorConstraints
)

const stateExtractorParameters = await getBenchmarkParameters(
  'State',
  stateExtractorConstraints
)

function calculatePaddedDataHashConstraints() {
  calculatePaddedDataHash(nDelimitedData)
}

const paddedDataHashParameters = await getBenchmarkParameters(
  'paddedDataHash',
  calculatePaddedDataHashConstraints
)

const benchmarkResults = [
  delimitDataParameters,
  dobAndGenderExtractorParameters,
  timestampParameters,
  pincodeExtractorParameters,
  stateExtractorParameters,
  paddedDataHashParameters,  
]

console.table(
  benchmarkResults.map((result) => ({
    Method: result.methodName,
    Rows: result.rowSize.rows,
  }))
)

// Prepare data for hashing and signature verifier benchmarks.
const dataBlocks = prepareRecursiveHashData(inputs.signedData)

const dataBlocksForHashBase = prepareRecursiveHashData(
  inputs.signedData.slice(0, 448)
)


async function hashAnalysis() {
  try {
    const hashProgramAnalysis = await hashProgram.analyzeMethods()

    console.log('hashProgram Method data')
    const hashProgramMethods = [
      {
        methodName: 'hashRecursive',
        rows: hashProgramAnalysis.hashRecursive.rows,
      },
      {
        methodName: 'hashBase',
        rows: hashProgramAnalysis.hashBase.rows,
      },
    ]
    console.table(hashProgramMethods)
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in hash analysis step:', e.message)
      console.error(e.stack)
    } else {
      console.error('Unknown error in hash analysis step:', e)
    }
  }
}

async function verifierAnalysis() {
  try {
    const signatureVerifierAnalysis = await SignatureVerifier.analyzeMethods()
    console.log('signatureVerifier Method data')
    const signatureVerifierconstraint = [
      {
        circuitName: 'verifySignature',
        rows: signatureVerifierAnalysis.verifySignature.rows,
      },
    ]
    console.table(signatureVerifierconstraint)
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in verifier analysis step:', e.message)
      console.error(e.stack)
    } else {
      console.error('Unknown error in verifier analysis step:', e)
    }
  }
}

async function AadhaarVerifierAnalysis() {
  try {
    const AadhaarVerifierAnalysis = await AadhaarVerifier.analyzeMethods()
    console.log('AadhaarVerifier Method data')
    const aadhaarVerifierMethods = [
      {
        circuitName: 'verifySignature',
        rows: AadhaarVerifierAnalysis.verifySignature.rows,
      },
      {
        circuitName: 'extractor',
        rows: AadhaarVerifierAnalysis.extractor.rows,
      },
    ]
    console.table(aadhaarVerifierMethods)
  } catch (e) {
    console.error('Error in AadhaarVerifier analysis step:', e)
  }
}


async function main() {
  await hashAnalysis()
  await verifierAnalysis()
  await AadhaarVerifierAnalysis()
}

await main()
