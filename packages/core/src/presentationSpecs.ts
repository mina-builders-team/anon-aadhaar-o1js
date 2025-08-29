import { Spec, Claim, Operation, Node } from 'mina-attestations';
import { AadhaarCredentialFactory } from './AadhaarCredential.js';
import { UInt64, Field, Provable } from 'o1js';

export function calculateAge(
  currentYear: Node<Field>,
  currentMonth: Node<Field>,
  currentDay: Node<Field>,
  dobYear: Node<Field>,
  dobMonth: Node<Field>,
  dobDay: Node<Field>
) {
  const ageByYear =  Operation.sub(Operation.sub(currentYear, dobYear), Operation.constant(Field(1)))

  // Check if current month > DOB month or if same month and current day >= DOB day
  const monthGt = Operation.lessThan(dobMonth, currentMonth)
  const monthEq = Operation.equals(dobMonth, currentMonth)
  const dayGt = Operation.lessThan(dobDay, Operation.add(currentDay, Operation.constant(Field(1))))
  const isHigherDayOnSameMonth = Operation.and(monthEq, dayGt)
  // Final age calculation
  const age = Operation.add(ageByYear, 
    Operation.ifThenElse(Operation.or(monthGt, isHigherDayOnSameMonth), Operation.constant(Field(1)), Operation.constant(Field(0))))
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
      const age = calculateAge(currentYear, currentMonth, currentDay, dobYear, dobMonth, dobDay)

      Provable.asProver(() => {
        console.log("ageMoreThan18Spec.Age: ", age.toString())
      })
      const ageMoreThan18 = Operation.lessThanEq(Operation.constant(Field(18)), age)

      return { 
        assert: [ageMoreThan18],
        outputClaim: Operation.record({
          pubKeyHash: Operation.property(credential, "pubKeyHash"),
          owner: Operation.owner
        }) 
      };
    } 
  );
}