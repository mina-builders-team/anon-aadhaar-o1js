# Benchmark Report

This benchmark report presents an analysis of the circuits and provable functions used in Anon Aadhaar. It includes constraint counts for provable functions (extractors and nullifier) and `ZkProgram` circuits. For provable functions, the `Provable.constraintSystem` API is used. Execution time for these functions is not measured, as they are currently executed outside of a circuit. They are planned to be used within the Aadhaar circuit, and for now, only their constraints are reported.

## Device Information

- CPU: Apple M2
- Cores: 8
- RAM: 16.00 GB
- Node.js Version: 23.5.0
- o1js Version: 2.4.0

## Methodology

Two different approaches are used for measurement:
- `Provable.constraintSystem` is used to analyze the constraint count of functions like extractors or the nullifier. Only constraints are measured, as these functions are standalone and their execution time cannot be determined outside of a circuit. To obtain accurate constraint values, inputs to these functions are provided using `Provable.witness`.
- `.analyzeMethods()` is used on `ZkProgram` circuits to extract constraint information in a structured format. To measure compile and execution times of `ZkProgram` methods, `performance.now()` is called before and after each computation.

To minimize the impact of cache optimizations during circuit compilation, the `forceRecompile` option is enabled.

## Provable Functions Analysis

Provable functions include extractors and the nullifier. Constraint counts are gathered using `Provable.constraintSystem`. For this API to work correctly, inputs must be provided as witnesses. Otherwise, constraint counts will appear as zero. A helper function named `getBenchmarkParameters` is used to streamline this process by returning both the constraint summary and method name.

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

Note: Execution time for the base hashing method depends on input size.

| Method Name         | Rows  | Time     |
| ------------------- |-------|----------|
| hashBase (7 blocks) | 42264 | 21.333 s |
| hashRecursive       | 26481 | 65.085 s |

## SignatureVerifier Method Analysis

| Method Name     | Rows  | Time     |
| --------------- | ----- | -------- |
| verifySignature | 38973 | 21.333 s |

## Conclusion and Remarks

There are opportunities to optimize the current implementation further, particularly to reduce the constraint count of some extractors significantly.

Currently, the `SignatureVerifier` circuit cannot be compiled with the `forceRecompile` option because it depends on the `hashProgram` in its `hashBlocks` method. When `forceRecompile` is enabled, `hashProgram` is not recognized as cached, which causes the circuit size to exceed the allowed limit. Therefore, the compilation time for `SignatureVerifier` should be interpreted alongside `hashProgram`.