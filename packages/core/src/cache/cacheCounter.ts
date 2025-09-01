import { Cache } from "o1js";
import { zkappFactory } from "../CounterZkapp.js";

async function cacheCounter(){
    const CounterCache: Cache = Cache.FileSystem('../ui/public/CounterCache')
    const {CounterZkapp} = await zkappFactory();
    await CounterZkapp.compile({cache: CounterCache});
}

await cacheCounter()


