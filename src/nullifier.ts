import { Field, Poseidon } from 'o1js';
export { nullifier };

function nullifier(nullifierSeed: Field, photo: Field[]) {
  const photoHash = Poseidon.hash(photo);
  return Poseidon.hash([nullifierSeed, photoHash]);
}
