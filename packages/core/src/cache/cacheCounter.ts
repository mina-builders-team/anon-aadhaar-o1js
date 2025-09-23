import { Cache } from "o1js";
import { CounterZkapp } from "../CounterZkapp.js";
import { hashProgram } from "../helpers/sha256Hash.js";
import { AadhaarVerifier } from "../AadhaarVerifier.js";

const HashCache: Cache = Cache.FileSystem('../ui/public/HashCache')
await hashProgram.compile({proofsEnabled:true, cache: HashCache})

const VerifierCache: Cache = Cache.FileSystem('../ui/public/VerifierCache')
await AadhaarVerifier.compile({proofsEnabled:true, cache: VerifierCache})

const zkappCache = Cache.FileSystem('../ui/public/zkappCache')
await CounterZkapp.compile({cache: zkappCache});