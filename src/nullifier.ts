import { Field, Poseidon } from 'o1js';
export { nullifier };

function nullifier(nullifierSeed: Field, photo: Field[]) {
  const first16 = Poseidon.hash(photo);
  return Poseidon.hash([nullifierSeed, first16]);
}
