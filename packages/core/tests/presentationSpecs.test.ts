import { calculateAge } from '../src/presentationSpecs.js';
import { Field } from 'o1js';

describe('PresentationSpecs test', () => {
  const cases = [
    [2025, 1, 1, 2000, 1, 1, 25n],
    [2025, 1, 14, 2000, 1, 15, 24n],
    [2025, 1, 15, 2000, 1, 15, 25n],
    [2025, 1, 16, 2000, 1, 15, 25n],
    [2025, 6, 10, 2000, 7, 20, 24n],
    [2025, 8, 10, 2000, 7, 20, 25n],
    [2025, 1, 1, 2000, 12, 31, 24n],
    [2025, 2, 28, 2004, 2, 29, 20n],
    [2025, 3, 1, 2004, 2, 29, 21n],
    [2024, 2, 29, 2004, 2, 29, 20n],
    [2025, 8, 13, 2025, 8, 13, 0n],
  ] as const;

  test.each(cases)(
    'calculateAge current=%i/%i/%i dob=%i/%i/%i -> %s',
    (cY, cM, cD, dY, dM, dD, expected) => {
      const age = calculateAge(Field(cY), Field(cM), Field(cD), Field(dY), Field(dM), Field(dD));
      expect(age.toBigInt()).toEqual(expected);
    }
  );
});