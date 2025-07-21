import { Field, Provable, UInt32 } from 'o1js'
import { getQRData, TEST_DATA } from './getQRData.js'
import {
  createDelimitedData,
  createPaddedQRData,
  prepareRecursiveHashData,
} from './testUtils.js'
import {
  ageAndGenderExtractor,
  delimitData,
  pincodeExtractor,
  stateExtractor,
  timestampExtractor,
} from './extractors.js'
import { getDelimiterIndices } from './utils.js'
import {
  DELIMITER_POSITION,
  DATA_ARRAY_SIZE,
  DELIMITER_ARRAY_SIZE,
} from './constants.js'
import { ConstraintSystemSummary } from 'o1js/dist/node/lib/provable/core/provable-context.js'
import { SignatureVerifier } from './signatureVerifier.js'
import { hashProgram } from './recursion.js'
import { nullifier } from './nullifier.js'

interface BenchmarkResults {
  methodName: string
  rowSize: ConstraintSystemSummary
}

interface CompilationResults {
  circuitName: string
  time: string
}

// Proof Generation Configuration
const proofsEnabled = true
const forceRecompile = true

// Input Preparation
const inputs = getQRData(TEST_DATA)
const qrDataPadded = inputs.paddedData.toBytes()
const signature = inputs.signatureBigint
const publicKey = inputs.publicKeyBigint
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

  const photoIndex = Provable.witness(UInt32, () =>
    UInt32.Unsafe.fromField(delimiterIndices[DELIMITER_POSITION.PHOTO - 1].add(1))
  )

  delimitData(dataArray, photoIndex)
}

function timestampExtractorConstraints() {
  const dataArray = Provable.witness(
    Provable.Array(Field, DATA_ARRAY_SIZE),
    () => qrData.map((x) => Field.from(x))
  )

  timestampExtractor(dataArray)
}

function ageAndGenderExtractorConstraints() {
  const delimitedDataArray = Provable.witness(
    Provable.Array(Field, DATA_ARRAY_SIZE),
    () => nDelimitedData
  )

  const day = Provable.witness(Field, () => Field.from(1))
  const month = Provable.witness(Field, () => Field.from(1))
  const year = Provable.witness(Field, () => Field.from(2024))

  ageAndGenderExtractor(delimitedDataArray, year, month, day)
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

const ageAndGenderExtractorParameters = await getBenchmarkParameters(
  'Age and Gender',
  ageAndGenderExtractorConstraints
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

// Analyzers for nullifier
function nullifierConstraints() {
  const nullifierSeed = Provable.witness(Field, () => Field.random())
  nullifier(nDelimitedData, nullifierSeed)
}

const nullifierParameters = await getBenchmarkParameters(
  'Nullifier',
  nullifierConstraints
)

const benchmarkResults = [
  delimitDataParameters,
  ageAndGenderExtractorParameters,
  timestampParameters,
  pincodeExtractorParameters,
  stateExtractorParameters,
  nullifierParameters,
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

const programCompilationTimes: CompilationResults[] = []

async function hashAnalysis() {
  try {
    // Compile circuit and record time
    let start = performance.now()
    await hashProgram.compile({ proofsEnabled, forceRecompile })
    let end = performance.now()
    const compileTime = ((end - start) / 1000).toFixed(3) + ' s'

    // hashRecursive timing
    start = performance.now()
    await hashProgram.hashRecursive(dataBlocks)
    end = performance.now()
    const hashRecursiveTime = ((end - start) / 1000).toFixed(3) + ' s'

    // hashBase timing
    start = performance.now()
    await hashProgram.hashBase(dataBlocksForHashBase)
    end = performance.now()
    const hashBaseTime = ((end - start) / 1000).toFixed(3) + ' s'

    // Prepare array for hashProgram methods and print table
    programCompilationTimes.push({
      circuitName: 'hashProgram',
      time: compileTime,
    })

    const hashProgramAnalysis = await hashProgram.analyzeMethods()

    console.log('hashProgram Method data')
    const hashProgramMethods = [
      {
        methodName: 'hashRecursive',
        rows: hashProgramAnalysis.hashRecursive.rows,
        time: hashRecursiveTime,
      },
      {
        methodName: 'hashBase',
        rows: hashProgramAnalysis.hashBase.rows,
        time: hashBaseTime,
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
    // Compile SignatureVerifier and record time
    let start = performance.now()
    await SignatureVerifier.compile({ proofsEnabled })
    let end = performance.now()
    const compileTime = ((end - start) / 1000).toFixed(3) + ' s'

    // Record verifySignature execution time
    start = performance.now()
    await SignatureVerifier.verifySignature(dataBlocks, signature, publicKey)
    end = performance.now()
    const verifyTime = ((end - start) / 1000).toFixed(3) + ' s'

    programCompilationTimes.push({
      circuitName: 'SignatueVerifier',
      time: compileTime,
    })

    const signatureVerifierAnalysis = await SignatureVerifier.analyzeMethods()

    const signatureVerifierconstraint = [
      {
        circuitName: 'verifySignature',
        rows: signatureVerifierAnalysis.verifySignature.rows,
        time: verifyTime,
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

async function main() {
  await hashAnalysis()
  await verifierAnalysis()
  console.table(programCompilationTimes)
}

await main()
