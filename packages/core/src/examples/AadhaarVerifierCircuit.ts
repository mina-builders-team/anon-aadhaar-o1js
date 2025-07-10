import { Field, Provable, SelfProof, Struct, UInt32, verify, ZkProgram } from "o1js";
import { Bigint2048, rsaVerify65537 } from "../rsa.js";
import { MerkleBlocks } from "../dataTypes.js";
import { BLOCKS_PER_RECURSIVE_PROOF, hashBlocks, hashProgram } from "../recursion.js";
import { state32ToBytes, pkcs1v15Pad, getDelimiterIndices } from "../utils.js";
import { DATA_ARRAY_SIZE, DELIMITER_ARRAY_SIZE, PHOTO_POSITION } from "../constants.js";
import { delimitData, timestampExtractor, ageAndGenderExtractor, pincodeExtractor, stateExtractor } from "../extractors.js";
import { nullifier } from "../nullifier.js";
import { getQRData, TEST_DATA } from "../getQRData.js";
import { createPaddedQRData, prepareRecursiveHashData } from "../testUtils.js";

class AadhaarOutputs extends Struct({
  Timestamp: Field,
  Age: Field,
  Gender: Field,
  Pincode: Field,
  State: Provable.Array(Field, 16),
  nullifiedValue: Field,
}) {}

const AadhaarVerifier = ZkProgram({
    name: 'aadhaar-verifier',
    publicOutput: AadhaarOutputs,

    methods: {
        verifySignature: {
            privateInputs: [MerkleBlocks, Bigint2048, Bigint2048],

            async method(
                blocks: MerkleBlocks,
                signature: Bigint2048,
                publicKey: Bigint2048
            ) {
                const hashState = await hashBlocks(blocks, BLOCKS_PER_RECURSIVE_PROOF)

                const finalHash = state32ToBytes(hashState)

                const paddedHash = pkcs1v15Pad(finalHash)

                rsaVerify65537(paddedHash, signature, publicKey)

                const emptyArray = Array.from({ length: 16 }, () => Field.from(0))
                return {publicOutput: new AadhaarOutputs({
                    Timestamp: Field.from(0),
                    Age: Field.from(0),
                    Gender: Field.from(0),
                    Pincode: Field.from(0),
                    State: emptyArray,
                    nullifiedValue: Field.from(0),
                })}
            },
        },
        extractor: {
            privateInputs: [SelfProof, Provable.Array(Field, DATA_ARRAY_SIZE), Provable.Array(Field, DELIMITER_ARRAY_SIZE), Field, Field, Field],

            async method(earlierProof: SelfProof<unknown, AadhaarOutputs>, data: Field[], delimiterIndices: Field[], currentYear: Field, currentMonth:Field, currentDay:Field){
                earlierProof.verify()
                const photoIndex = UInt32.Unsafe.fromField( delimiterIndices[PHOTO_POSITION - 1].add(1))
                const nDelimitedData = delimitData(data, photoIndex)

                const timestamp = timestampExtractor(nDelimitedData)

                const [age, gender] = ageAndGenderExtractor(
                nDelimitedData,
                delimiterIndices,
                currentYear,
                currentMonth,
                currentDay
                );
                const pincode = pincodeExtractor(nDelimitedData, delimiterIndices)
                const state = stateExtractor(nDelimitedData, delimiterIndices)

                // This can/should be given as an input to the circuit.
                const nullifierSeed = Field.from(123124124214)

                const nullifiedValue = nullifier(nDelimitedData, nullifierSeed)
                return {
                publicOutput: new AadhaarOutputs({
                    Timestamp: timestamp,
                    Age: age,
                    Gender: gender,
                    Pincode: pincode,
                    State: state,
                    nullifiedValue: nullifiedValue,
                }),
                }           
            }
        }
    }
});

await hashProgram.compile()
const { verificationKey } = await AadhaarVerifier.compile({proofsEnabled: true});

const inputs = getQRData(TEST_DATA)
const preparedData = prepareRecursiveHashData(inputs.signedData)

const qrDataPadded = inputs.paddedData.toBytes()
let qrData = createPaddedQRData(qrDataPadded).map(Field)
let delimiterIndices = getDelimiterIndices(qrDataPadded).map(Field)

const day = Field.from(1)
const month = Field.from(1)
const year = Field.from(2024)

const summary = await AadhaarVerifier.analyzeMethods()
console.log(summary)
console.time("verifySignature");
const verificationProof = await AadhaarVerifier.verifySignature(preparedData, inputs.signatureBigint, inputs.publicKeyBigint)
await verify(verificationProof.proof, verificationKey);
console.timeEnd("verifySignature");

console.time("Extractor");
const extractorProof = await AadhaarVerifier.extractor(verificationProof.proof, qrData, delimiterIndices, year, month, day)
await verify(extractorProof.proof, verificationKey);
console.timeEnd("Extractor");