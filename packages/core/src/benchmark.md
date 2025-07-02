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


To minimize the impact of cache optimizations during circuit compilation, the `forceRecompile` option is enabled. Yet, it is not used for `SignatureVerifier`. While benchmarking the `SignatureVerifier` with `forceRecompile` option, `RuntimeError: unreachable` is occurred. In o1js, this error can indicate that circuit row size limit (~65k rows) is exceeded. Since `SignatureVerifier` uses `hashBlocks` that uses `hashProgram`, this option causes the compilation of both `SignatureVerifier` and already compiled `hashProgram`, hence exceeds the circuit limit. Normally, what should happen is once the `hashProgram` is compiled, compilation step of `SignatureVerifier` should get the compiled from cache and use it instead of recompiling all components. For that reason, 


## Provable Functions Analysis

Provable functions include extractors and the nullifier. Constraint counts are gathered using `Provable.constraintSystem`. For this API to work correctly, inputs must be provided as witnesses. Otherwise, constraint counts will appear as zero. A helper function named `getBenchmarkParameters` is used to streamline this process by returning both the constraint summary and method name.

| Extractor             | Rows   |
| --------------------- | ------ |
| delimitData           | 10753 |
| ageAndGenderExtractor | 9416  |
| timestampExtractor    | 953    |
| pincodeExtractor      | 3837   |
| stateExtractor        | 12328  |
| nullifier             | 13    |

## ZkProgram Compilation Times

| Circuit Name      | Time     |
| ----------------- | -------- |
| hashProgram       | 93.137 s |
| SignatureVerifier | 7.519 s  |

## hashProgram Method Analysis

Note: Execution time for the base hashing method depends on input size. Also remind that `hashRecursive` is called recursively depending on the length of the data blocks. For 5 blocks a new `hashRecursive` is called.

| Method Name         | Rows  | Time     |
| ------------------- |-------|----------|
| hashBase (7 blocks) | 42264 | 33.521 s |
| hashRecursive       | 26481 | 101.592 s |

## SignatureVerifier Method Analysis

| Method Name     | Rows  | Time     |
| --------------- | ----- | -------- |
| verifySignature | 38973 | 113.528 s |

## Conclusion and Remarks

There are opportunities to optimize the current implementation further, particularly to reduce the constraint count of some extractors significantly.

Currently, the `SignatureVerifier` circuit cannot be compiled with the `forceRecompile` option because it depends on the `hashProgram` in its `hashBlocks` method. When `forceRecompile` is enabled, `hashProgram` is not recognized as cached, which causes the circuit size to exceed the allowed limit. Therefore, the compilation time for `SignatureVerifier` should be interpreted alongside `hashProgram`.