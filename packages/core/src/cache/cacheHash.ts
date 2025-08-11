import { Cache } from "o1js";
import { hashProgram } from "../helpers/sha256Hash.js";

async function cacheCircuits(){
    const HashCache: Cache = Cache.FileSystem('../ui/public/HashCache')
    await hashProgram.compile({proofsEnabled:true, cache: HashCache})
}

await cacheCircuits()


