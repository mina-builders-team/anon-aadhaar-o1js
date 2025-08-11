import { Field, Poseidon, Provable, SelfProof, Struct, UInt32, ZkProgram } from "o1js";
import { DATA_ARRAY_SIZE, DELIMITER_ARRAY_SIZE } from "./constants.js";
import { MerkleBlocks } from "./helpers/dataTypes.js";
import { delimitData, timestampExtractor, ageAndGenderExtractor, pincodeExtractor, stateExtractor } from "./helpers/extractors.js";
import { nullifier } from "./helpers/nullifier.js";
import { hashBlocks, BLOCKS_PER_RECURSIVE_PROOF } from "./helpers/sha256Hash.js";
import { Bigint2048, rsaVerify65537 } from "./helpers/rsa.js";
import { state32ToBytes,pkcs1v15Pad } from "./utils.js";

export { AadhaarVerifier, AadhaarVerifierProof }

class AadhaarOutputs extends Struct({
  Timestamp: Field,
  Age: Field,
  Gender: Field,
  Pincode: Field,
  State: Provable.Array(Field, 17),
  nullifiedValue: Field,
  pubKeyHash: Field
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

                const pubKeyHash = Poseidon.hash(publicKey.fields)

                const emptyArray = Array.from({ length: 17 }, () => Field.from(0))
                return {publicOutput: new AadhaarOutputs({
                    Timestamp: Field.from(0),
                    Age: Field.from(0),
                    Gender: Field.from(0),
                    Pincode: Field.from(0),
                    State: emptyArray,
                    nullifiedValue: Field.from(0),
                    pubKeyHash: pubKeyHash
                })}
            },
        },
        extractor: {
            privateInputs: [SelfProof, Provable.Array(Field, DATA_ARRAY_SIZE), Field, Field, Field],

            async method( earlierProof: SelfProof<unknown,AadhaarOutputs>, data: Field[], currentYear: Field, currentMonth:Field, currentDay:Field){
                earlierProof.verify()
                const nDelimitedData = delimitData(data)

                const timestamp = timestampExtractor(nDelimitedData)

                const [age, gender] = ageAndGenderExtractor(
                nDelimitedData,
                currentYear,
                currentMonth,
                currentDay
                );
                const pincode = pincodeExtractor(nDelimitedData)
                const state = stateExtractor(nDelimitedData)

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
                    pubKeyHash: earlierProof.publicOutput.pubKeyHash
                }),
                }           
            }
        }
    }
});

class AadhaarVerifierProof extends ZkProgram.Proof(AadhaarVerifier){}