import { Spec, Claim, Operation, Node } from 'mina-attestations';
import { AadhaarCredentialFactory } from './AadhaarCredential.js';
import { UInt64, Field } from 'o1js';

export function calculateAge(currentYear: Field, currentMonth: Field, currentDay: Field, dobYear: Field, dobMonth: Field, dobDay: Field) {
  const ageByYear = currentYear.sub(dobYear).sub(Field(1))

  // Check if current month > DOB month or if same month and current day >= DOB day
  const monthGt = currentMonth.greaterThan(dobMonth).toField()
  const monthEq = currentMonth.equals(dobMonth).toField()
  const dayGt = currentDay.add(Field(1)).greaterThan(dobDay).toField()
  const isHigherDayOnSameMonth = monthEq.mul(dayGt)

  // Final age calculation
  const age = ageByYear.add(monthGt.add(isHigherDayOnSameMonth))
  return age
}

export async function ageMoreThan18Spec() {
  return Spec(
    {
      credential: (await AadhaarCredentialFactory()).spec,
      currentDay: Claim(Field),
      currentMonth: Claim(Field),
      currentYear: Claim(Field),
    },
    ({ credential, currentDay, currentMonth, currentYear }) => {
      const dobDay = Operation.property(credential, "DobDay");
      const dobMonth = Operation.property(credential, "DobMonth");
      const dobYear = Operation.property(credential, "DobYear");
      const age = Operation.compute(
        [currentYear, currentMonth, currentDay, dobYear, dobMonth, dobDay],
        Field,
        calculateAge
      );

      const assert = Operation.lessThanEq(Operation.constant(UInt64.from(18)), age)

      return { assert, outputClaim: Operation.property(credential, "pubKeyHash") };
    } 
  );
}