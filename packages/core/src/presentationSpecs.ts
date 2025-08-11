import { Spec, Claim, Operation } from 'mina-attestations';
import { AadhaarCredentialFactory } from './AadhaarCredential.js';
import { UInt64 } from 'o1js';

export async function ageMoreThan18Spec() {
    return Spec(
    {
      credential: (await AadhaarCredentialFactory()).spec,
      currentDate: Claim(UInt64),
    },
    ({ credential, currentDate }) => {
      // extract properties from the credential
      const age = Operation.property(credential, "Age");

      const assert = Operation.lessThanEq(Operation.constant(UInt64.from(18)), age)

      return { assert };
    }
  );
}