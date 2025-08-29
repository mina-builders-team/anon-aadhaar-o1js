
import { Bytes, Field, Int64, PrivateKey, Provable, UInt64 } from 'o1js';
import {
  Spec,
  Operation,
  Claim,
  Credential,
  Presentation,
  PresentationRequest,
  assert,
  DynamicString,
  DynamicArray,
  DynamicRecord,
  Schema,
  hashDynamic,
} from 'mina-attestations';

// example schema of the credential, which has enough entropy to be hashed into a unique id
const Bytes16 = Bytes(16);


// ---------------------------------------------
const { publicKey: owner, privateKey: ownerKey } = PrivateKey.randomKeypair();
const { publicKey: issuer, privateKey: issuerKey } = PrivateKey.randomKeypair();
function randomPublicKey() {
    return PrivateKey.random().toPublicKey();
}
const String = DynamicString({ maxLength: 50 });

const AadharCredential = await Credential.Imported.fromMethod(
    {
        name: 'aadhar',
        publicInput: { issuer: Field },
        privateInput: { 
            data: Provable.Array(Field, 10)
        },
        data: { name: String },
    },
    async ({ privateInput }) => {
        Provable.asProver(() => {
            Provable.log("AadharCredential" ,privateInput.data.toString());
        });
        // verify aadhar data signature
        // extract aadhar data
      return {
        name: String.from("test"),
        // rest of aadhar data
      };
    }
  );
// AadharCredential = Object.assign(AadharCredential, { name:  });
console.time('compilation');
const vk = await AadharCredential.compile();
console.timeEnd('compilation');

console.time('Credential creation');
const cred = await AadharCredential.create({
    owner,
    publicInput: { issuer: 1001 },
    privateInput: {
        data: [1n,2n,3n,4n,5n,6n,7n,8n,9n,10n]
    },
});
console.timeEnd('Credential creation');

console.time('Credential validation');
await Credential.validate(cred);
console.timeEnd('Credential validation');

// serialization/deserialization
const credentialJson = Credential.toJSON(cred);
const storedCredential = await Credential.fromJSON(credentialJson);

console.time('Credential validation');
await Credential.validate(storedCredential);
console.timeEnd('Credential validation');

// ---------------------------------------------
// Presentation
const spec = Spec(
    {
      credential: AadharCredential.spec,
      currentDate: Claim(UInt64),
      appId: Claim(String),
    },
    ({ credential, currentDate, appId }) => {
      // extract properties from the credential
      const name = Operation.property(credential, 'name');
      const issuer = Operation.issuer(credential);
        
      Provable.asProver(() => {
        console.log(`name: ${name} issuer: ${issuer}`);
      });

      const assert = Operation.equals(name, Operation.constant(String.from("test")))

      return { assert, outputClaim: name };
    }
  );

  const request = PresentationRequest.https(
    spec,
    {
      currentDate: UInt64.from(Date.now()),
      appId: String.from('my-app-id:123'),
    },
    { action: 'my-app-id:123:authenticate' }
  );
  const requestJson = PresentationRequest.toJSON(request);
  
  console.log(
    '✅ VERIFIER: created presentation request:',
    requestJson.slice(0, 500) + '...'
  );


// client side
console.time('spec compile');
const deserialized = PresentationRequest.fromJSON('https', requestJson);
const compiled = await Presentation.compile(deserialized);
console.timeEnd('spec compile');

const info = (await compiled.program.program.analyzeMethods()).run;
console.log('circuit gates summary', info?.summary());

console.time('create');
const presentation = await Presentation.create(ownerKey, {
  request: compiled,
  credentials: [{...storedCredential, key: "credential"}],
  context: { verifierIdentity: 'my-app.xyz' },
});
console.timeEnd('create');
const serialized = Presentation.toJSON(presentation);

console.log(
    '✅ WALLET: created presentation:',
    serialized.slice(0, 500) + '...'
  );


// verifier side
const presentation2 = Presentation.fromJSON(serialized);
console.time('verify');
const outputClaim = await Presentation.verify(request, presentation2, {
  verifierIdentity: 'my-app.xyz',
});
console.timeEnd('verify');
console.log('✅ VERIFIER: verified presentation');
console.log(outputClaim.toString());