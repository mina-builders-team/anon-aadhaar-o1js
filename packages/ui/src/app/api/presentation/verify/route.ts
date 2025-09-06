import { NextResponse } from 'next/server';
import { Presentation, PresentationRequest } from 'mina-attestations';
import { AADHAAR_PROD_PUBLIC_KEY_HASH, AADHAAR_TEST_PUBLIC_KEY_HASH } from 'anon-aadhaar-o1js';

export async function POST(req: Request) {
  try {
    const { requestJson, presentationJson, environment } = await req.json();
    if (!requestJson || !presentationJson) {
      return NextResponse.json({ error: 'missing_payload' }, { status: 400 });
    }
    console.time('verifying Presentation took')
    const request = PresentationRequest.fromJSON('https', requestJson);
    const presentation = Presentation.fromJSON(presentationJson);
    const outputClaim = await Presentation.verify(request, presentation, {
        verifierIdentity: 'anon-aadhaar-o1js.demo',
    });
    console.timeEnd('verifying Presentation took')
    // check pubKeyHash matches the official public key hash
    if (environment === 'prod' && outputClaim.pubKeyHash.toString() !== AADHAAR_PROD_PUBLIC_KEY_HASH) {
      return NextResponse.json({ ok: false, error: 'verification_failed, pubKeyHash does not match' }, { status: 200 });
    } else if (environment === 'test' && outputClaim.pubKeyHash.toString() !== AADHAAR_TEST_PUBLIC_KEY_HASH) {
      return NextResponse.json({ ok: false, error: 'verification_failed, pubKeyHash does not match' }, { status: 200 });
    }
    return NextResponse.json({ ok: true, outputClaim: JSON.stringify(outputClaim)});
  } catch (e) {
    console.error('Error verifying presentation', e);
    return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 500 });
  }
}
