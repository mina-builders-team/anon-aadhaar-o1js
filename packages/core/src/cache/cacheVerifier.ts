import { Cache } from "o1js";
import { AadhaarVerifier } from "../AadhaarVerifier.js";
import { hashProgram } from "../helpers/sha256Hash.js";

async function cacheCircuits(){
    const VerifierCache: Cache = Cache.FileSystem('../ui/public/VerifierCache')
    await hashProgram.compile()
    await AadhaarVerifier.compile({proofsEnabled:true, cache: VerifierCache})
}

await cacheCircuits()


