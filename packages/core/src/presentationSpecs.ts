import { Spec, Claim, Operation } from 'mina-attestations';
import { AadharCredential } from './AadharCredential';
import { UInt64 } from 'o1js';

export const ageMoreThan18Spec = Spec(
    {
      credential: AadharCredential.spec,
      currentDate: Claim(UInt64),
    },
    ({ credential, currentDate }) => {
      // extract properties from the credential
      const age = Operation.property(credential, "Age");

      const assert = Operation.lessThanEq(Operation.constant(UInt64.from(18)), age)

      return { assert };
    }
  );