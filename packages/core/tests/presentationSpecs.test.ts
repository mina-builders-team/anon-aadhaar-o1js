import { Presentation } from 'mina-attestations';
import { ageMoreThan18Spec } from '../src/presentationSpecs.js';
import { Field } from 'o1js';

describe('PresentationSpecs test', () => {
  
  it('spec should compile', async () => {
    const spec = await ageMoreThan18Spec();
    await Presentation.precompile(spec);
  });
});