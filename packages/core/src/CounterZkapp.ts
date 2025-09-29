import {
  Field,
  method,
  Permissions,
  Provable,
  SmartContract,
  State,
  state,
} from 'o1js'
import { AadhaarVerifierProof } from './AadhaarVerifier.js'
export { CounterZkapp }

class CounterZkapp extends SmartContract {
  @state(Field) public counter = State<Field>()

  async deploy() {
    super.deploy()
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.none(),
    })
  }

  @method async initialize() {
    const isInitialized = this.account.provedState.getAndRequireEquals()
    isInitialized.assertFalse('This ZkApp is already initialized.')

    super.init()

    this.counter.set(Field.from(0))
  }

  @method async verifyAadhaar(aadhaarProof: AadhaarVerifierProof, currentYear: Field, currentMonth: Field, currentDay: Field, pubKeyHash: Field) {
    aadhaarProof.verify()

    const publicOutputs = aadhaarProof.publicOutput;

    publicOutputs.Timestamp.greaterThan(0)

    publicOutputs.pubKeyHash.assertEquals(pubKeyHash, 'pubKeyHash does not match!');

    const dobYear = publicOutputs.DobYear;
    const dobMonth = publicOutputs.DobMonth;
    const dobday = publicOutputs.DobDay;

    // Calculate age based on year

    const ageByYear = currentYear.sub(dobYear).sub(Field(1));

    // Check if current month > DOB month or if same month and current day >= DOB day

    const monthGt = currentMonth.greaterThan(dobMonth).toField();

    const monthEq = currentMonth.equals(dobMonth).toField();

    const dayGt = currentDay.add(Field(1)).greaterThan(dobday).toField();

    const isHigherDayOnSameMonth = monthEq.mul(dayGt);
    // Final age calculation

    const age = ageByYear.add(monthGt.add(isHigherDayOnSameMonth));

    const updateValue = Provable.if(age.greaterThan(18), Field, Field.from(1), Field.from(0));
    const counterValue = this.counter.getAndRequireEquals()
    const updatedNum = counterValue.add(updateValue)

    this.counter.set(updatedNum)
  }
}
