# Anon Aadhaar in o1js
> [!WARNING]
> This repository is not audited,so we do not recommend you to use this project for production code.

Anon Aadhaar is a privacy-preserving protocol that enables users to prove specific attributes from their Aadhaar identity—such as age, residency, or gender—without revealing their full identity. It utilizes zero-knowledge proofs to allow users to generate verifiable claims based on data extracted from Aadhaar QR codes issued by the Indian government, ensuring that no sensitive personal information is exposed unless **explicitly** chosen by the user.

Anon Aadhaar protocol works on the client side, which ensures that no server stores user information. Users can generate ZK proofs (specifically, zk-SNARK proofs) on their device and use it for many use cases.

## What is Aadhaar?

**Aadhaar QR Code** is a machine-readable representation embedded in Aadhaar documents containing identity information such as name, gender, DOB, address, and a photograph. Issued by UIDAI, the QR code enables offline verification of Aadhaar data without needing internet access, ensuring authenticity and privacy.

In the Aadhaar QR code, identity data is embedded in a structured, encrypted format with a total size of up to 255 bytes. Each field occupies a fixed-length segment within this payload. For more detailed specifications of Aadhaar QR, please see the [official manual](https://uidai.gov.in/images/resource/User_manulal_QR_Code_15032019.pdf).

## How does it work?

The architecture is split into two parts: 
- Data Extraction & Processing 
- Proof Generation

In the first part, the user fetches data from UIDAI, validates it, and processes it to use it in circuits.

In the second part, by using user's private data, proof generation is done on the user’s device. 

### Data Extraction & Processing

In the first part of the protocol, these steps are followed:

- Data of a user is fetched in QR form and RSA Public Key issued by the Indian Government.
- The raw QR code contains data in compressed form. Data is decompressed into a byte array.
- The last 256 bytes of the decompressed data represent the signature of the corresponding identity data.
- The remaining byte array contains identity data, which can be parsed according to the specifications provided by UIDAI.

```mermaid
---
config:
  theme: default
---

flowchart TD
    A["UIDAI DB"] --> X[/"Raw QR Data"/]
    A --> Y[/"RSA Public Key"/]
    X --> B["Convert data to BigInt and decompress with DEFLATE algorithm"]
    Y --> B
    B --> C["Parse the data into signed components and corresponding signature"]
    C -- "Last 256 Bytes" --> n1[/"Signature"/]
    C -- "Bytes until last 256 bytes" --> n2[/"Signed Data"/]
    n2 --> n3["Aadhaar QR Verifier Circuit"]
    n1 --> n3

    %% Optional: styling classes (only colors supported, no shape changes)
    classDef blueNode fill:#1E88E5,stroke:#0D47A1,color:#FFFFFF
    classDef roundedNode rx:15,ry:15,fill:#2C3E50,stroke:#1ABC9C,color:#FFFFFF
    class A,B,C,n1,n2,n3 roundedNode
    class n2,n1,X,Y blueNode

```

### Proof Generation

After the data is split into the **signature** and **signed data**, it can be used in a ZK circuit to prove identity information in a privacy-preserving manner. The verifier circuit for Aadhaar QR consists of two components: **Signature Verifier** and **Extractor**. In the signature verifier component, the RSA signature is verified, while in the extractor component, the fields in the data are extracted in a provable manner.

#### Inputs


The Aadhaar QR verifier circuit takes the following inputs:

- **Signature** and **Signed Data**, which are obtained off the circuit. The signature is used in the verification component together with the signed data.
- **RSA Public Key**, which is fetched from UIDAI off the circuit.
- **Nullifier Seed**, which is used to generate a **nullifier** by hashing it with the user's photo. This prevents the same Aadhaar from being used multiple times for the same action or across apps, while keeping the identity private.

#### Signature Verifier Component

The signature verification is performed by this component using the signature and signed data, and follows these steps:

- The **Signature Verifier** template receives the signature and signed data.
- The signed data is hashed using the **SHA-256** algorithm.
- The hash of the data is then used in RSA signature verification.
- Upon successful verification, the RSA public key obtained from UIDAI is hashed and output to confirm that the correct public key was used for signature verification.

#### Extractor Component

For each field in the data, a dedicated extractor circuit is used to extract the value and apply the necessary constraints. Since each field has a predefined byte position, as specified by UIDAI, each extractor operates on **fixed byte offsets** corresponding to the field it extracts.

- Extraction proceeds in the following steps:
    - **Timestamp Extraction**: The timestamp indicating when the QR code was signed is extracted from the data. It is converted from IST to UNIX UTC format. Using this value, the year, month, and day are computed and returned as integers, along with the original timestamp.
    - **Date of Birth Extraction**: The date of birth is extracted from the Aadhaar data and converted into day, month, and year components. Later on, extracted Date of Birth can be used to calculated age.
    - **Gender Extraction**: Gender is extracted from the data and returned as a single-byte integer representing the gender code.
    - **Pincode Extraction**: The pincode is extracted by reading a predefined byte range within the address field. It is returned as a 6-digit integer representing the user's postal code.
    - **Photograph Extraction**: The photograph is extracted from the data, depending on the version of the Aadhaar QR code. It is returned as a big-endian integer array—typically of length 33—representing the encoded image data.

#### Outputs


Along with the proof, the following values are output:

- **Nullifier**, calculated using photograph bytes and the nullifier seed.
- **Timestamp**, obtained from the **Timestamp Extractor** component.
- **Public Key Hash**, derived by hashing the RSA public key in the signature verifier component.
- **Date of Birth**, **Gender**, **State**, and **Pincode**, extracted from the identity data and returned along with the proof.
```mermaid
flowchart TD
    %% Main sections
    Inputs["Inputs"] --> AadhaarVerifier["Aadhaar QR Verifier Circuit"]
    AadhaarVerifier["Aadhaar QR Verifier Circuit"] --> Outputs["Outputs"]
    
    %% Input section contents
    subgraph Inputs

        Signature[/"Signature"/]
        SignedData[/"Signed Data"/]
        RSAPublicKey[/"RSA Public Key"/]
        nullifierSeed[/"Nullifier Seed"/]
    end
    
    %% Aadhaar Verifier Circuit contents
    subgraph AadhaarVerifier["Aadhaar QR Verifier Circuit"]
        subgraph SignatureVerifierTemplate["Signature Verifier Template"]
            ApplySHA256["Apply SHA256 to data"] --> VerifyRSA1["Verify the RSA signature of the hashed data"]
            VerifyRSA1 --> VerifyRSA2["Hash the RSA public key and output it"]
        end
        
        subgraph ExtractorTemplate["Extractor Template"]
		        direction TB
            ExtractFields["Extract the timestamp, date of birth, gender, pincode, state And photograph from data"]
        end

        SignatureVerifierTemplate --> ExtractorTemplate 

        ExtractorTemplate --> anonNode2["Compute the nullifier using nullifier seed and extracted photo"]
    end
    
    %% Output section contents
    subgraph Outputs
        
        Nullifier[/"Nullifier"/]
        Timestamp[/"Timestamp"/]
        pubKeyHash[/"Public Key Hash"/]
        dob[/"Date of Birth"/]
        gen[/"Gender"/]
        pinc[/"Pincode"/]
        stat[/"State"/]
        nullifierSeed2[/"Nullifier Seed"/]
    end

    %% Dark mode friendly styles
    classDef orangeNode fill:#FF9E45,stroke:#FF7D1A,color:#000000
    classDef blueNode fill:#1E88E5,stroke:#0D47A1,color:#FFFFFF
    classDef roundedNode rx:15,ry:15,fill:#2C3E50,stroke:#1ABC9C,color:#FFFFFF
    classDef subgraphStyle fill:#1A202C,stroke:#2D3748,color:#FFFFFF
    linkStyle default stroke:#d7d8da, color:#d7d8da
    %% Apply styles
    class AgeAbove18,Gender,State,Pincode orangeNode
    class Signature,SignedData,RSAPublicKey,signalHash,nullifierSeed,Nullifier,Timestamp,pubKeyHash,dob,stat,pinc,gen,nullifierSeed2 blueNode
    class ExtractFields,ApplySHA256,VerifyRSA1,VerifyRSA2,VerifyRSA3,VerifyRSA4,anonNode,anonNode2 roundedNode
    class Inputs,Outputs,AadhaarVerifier,SignatureVerifierTemplate,ExtractorTemplate,OptParams,OptOutputs subgraphStyle
```

## Advancements

o1js implementation of Anon Aadhaar differs from **circom** and **noir** implementations in some architecture designs. In o1js, it is possible to store the proof in users wallets - which enables users to create private attestations afterwards using this proof. In that way, a system where **proof of proofs** can be used for creating statements on some information. In the original implementation, gender, state, pincode and a boolean value indicates that age is over 18 is revealed by taking boolean values to reveal these values. In o1js implementation, it is possible to use private credentials to use the public outputs of the proof and create credentials proving these statements.

## Resources

- [Anon Aadhaar Documentation](https://documentation.anon-aadhaar.pse.dev/docs/intro) - Comprehensive guide on the Anon Aadhaar system, provided by the PSE team.
- [Anon Aadhaar Implementation](https://github.com/anon-aadhaar/anon-aadhaar/tree/main) - The official repository for Anon Aadhaar implementation by the PSE team in Circom.
- [Aadhaar Secure QR Code Specification](https://uidai.gov.in/images/resource/User_manulal_QR_Code_15032019.pdf) -  This document provides the detailed specification for the Secure QR code used in Aadhaar.

# How to Build & Test

## How to build

```sh
pnpm run build
```

## How to run tests

```sh
pnpm run test
```

## How to run benchmark
[Benchmark Results](./packages/core/src/benchmark.md)

When the benchmark is run using the following command, it should produce a table in the same format as shown in `benchmark.md`.

```sh
cd packages/core && pnpm run benchmark
```
