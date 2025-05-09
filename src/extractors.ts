import { Field } from 'o1js';

function extractData(paddedData: Field[], startIndex: Field) {
  let n255Filter = Field.from(0);
  const twoFiftyFive = Field.from(255);

  let is255 = Field.from(0);
  let indexBeforePhoto = Field.from(0);
  let is255AndIndexBeforePhoto = Field.from(0);
  for (let i = 0; i < 1536; i++) {
    is255 = paddedData[i].equals(twoFiftyFive).toField();

    indexBeforePhoto = Field(i).lessThan(startIndex).toField();
    is255AndIndexBeforePhoto = is255.mul(indexBeforePhoto);

    n255Filter = is255AndIndexBeforePhoto.mul(255).add(n255Filter);

    paddedData[i] = is255AndIndexBeforePhoto.mul(n255Filter).add(paddedData[i]);
  }

  return paddedData;
}
