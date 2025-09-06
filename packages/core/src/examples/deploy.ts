import { AccountUpdate, fetchAccount, Mina, PrivateKey, PublicKey } from "o1js";
import { zkappFactory } from "../CounterZkapp.js";
import fs from 'fs';
import {MINA_NODE_ENDPOINT, MINA_ARCHIVE_ENDPOINT} from '../constants.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keysPath = path.join(__dirname, '../../../src/keys/');

// Generate random zkApp keys
const zkAppPrivateKey = PrivateKey.random();
const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

const keyPairs = {
  zkAppPrivateKey: zkAppPrivateKey.toBase58(),
  zkAppPublicKey: zkAppPublicKey.toBase58(),
};

if (!fs.existsSync(keysPath)) {
  fs.mkdirSync(keysPath, { recursive: true });
}

const keyPairsString = JSON.stringify(keyPairs, null, 2);
const ver = 0;

fs.writeFileSync(`${keysPath}/keyPairs${ver}.json`, keyPairsString, "utf-8");
console.log(`keyPairs${ver}.json is saved. Fund them before using them in CounterZkapp creation.`);

// Load your personal keys
const keys = JSON.parse(fs.readFileSync(`${keysPath}testKeys.json`,"utf-8"));

const privateKey = PrivateKey.fromBase58(keys.privateKey);
const publicKey = PublicKey.fromBase58(keys.publicKey); 

const network = Mina.Network(
  {
    mina: MINA_NODE_ENDPOINT,
    archive: MINA_ARCHIVE_ENDPOINT
  }
);

Mina.setActiveInstance(network);
await fetchAccount({publicKey: publicKey});

const {CounterZkapp, ProvablePresentation} = await zkappFactory();

const {verificationKey} = await CounterZkapp.compile({forceRecompile: true});

const zkApp = new CounterZkapp(zkAppPublicKey);

const deployTx = await Mina.transaction({sender: publicKey, fee:1e9}, async () => {
  AccountUpdate.fundNewAccount(publicKey);
  zkApp.deploy();
  await zkApp.initialize();
})

await deployTx.prove();

const pendingTransaction = await deployTx.sign([zkAppPrivateKey,privateKey]).send();
const status = await pendingTransaction.safeWait();

await fetchAccount({publicKey: zkAppPublicKey});

console.log(`Tx hash: ${status.hash} \n See tx status: https://minascan.io/devnet/tx/${pendingTransaction.hash}`);
