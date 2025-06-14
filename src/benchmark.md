# Benchmark Report

This benchmark report presents analysis of the circuits and provable functions that are used in Anon Aadhaar. Benchmark report includes constraints of provable functions (extractors and nullifier) and `ZkProgram` circuits.
For provable functions, `Provable.constraintSystem` API is used. Execution time of the provable functions can not be determined, since they are executed out of circuit at the moment and planned to be used in the Aadhaar circuit, only constraints of them is put in the report.

## Device Information

- CPU: Apple M2
- Cores: 8
- RAM: 16.00 GB
- Node.js Version: 23.5.0
- o1js Version: 2.4.0

## Provable Functions Analysis

Provable functions consist of extractors and nullifier. For calculating the constraints, `Provable.constraintSytstem`is used. To make this API to measure the constarint values, execution of these functions should be done with witnessed inputs. Otherwise, contraints will be displayed as 0. To make the process more neat, a function called `getBenchmarkParameters` is used, returns the constraint summaries and name of the extraction done.

| Extractor             | Rows   |
| --------------------- | ------ |
| delimitData           | 633984 |
| ageAndGenderExtractor | 20058  |
| timestampExtractor    | 953    |
| pincodeExtractor      | 9219   |
| stateExtractor        | 49280  |
| photoExtractor        | 101387 |
| photoExtractorChunked | 107323 |
| nullifier             | 220    |

## ZkProgram Compilation Times

| Circuit Name      | Time     |
| ----------------- | -------- |
| hashProgram       | 65.613 s |
| SignatureVerifier | 7.229 s  |

## hashProgram Method Analysis

Note: Time it takes for the base hashing method varies depending on the size of the input.

| Method Name         | Rows  | Time     |
| ------------------- |-------|----------|
| hashBase (7 blocks) | 42264 | 21.333 s |
| hashRecursive       | 26481 | 65.085 s |

## SignatureVerifier Method Analysis

| Method Name     | Rows  | Time     |
| --------------- | ----- | -------- |
| verifySignature | 38973 | 21.333 s |

## Conclusion and Remarks

Existing implementation has optimizations available, that can reduce the constraints of some extractors drastically.

Also, at the moment `SignatureVerifier` circuit can not be compiled with `forceRecompile` option, since it uses `hashProgram` in `hashBlocks` methods - which is causing circuit limit to be exceeded since `hashProgram` is not seen as cached when `SignatureVerifier` is compiled with `forceRecompile` option. Hence, compilatino time of `SignatureVerifier` should be considered together with `hashProgram`.
