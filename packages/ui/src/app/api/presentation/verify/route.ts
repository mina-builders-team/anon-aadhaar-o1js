import { NextResponse } from 'next/server';
import { Presentation, PresentationRequest } from 'mina-attestations';

export async function POST(req: Request) {
  try {
    const { requestJson, presentationJson } = await req.json();
    if (!requestJson || !presentationJson) {
      return NextResponse.json({ error: 'missing_payload' }, { status: 400 });
    }
    console.time('verify Presentation')
    const request = PresentationRequest.fromJSON('https', requestJson);
    const presentation = Presentation.fromJSON(presentationJson);
    const outputClaim = await Presentation.verify(request, presentation, {
        verifierIdentity: 'anon-aadhaar-o1js.demo',
    });
    
    console.timeEnd('verify Presentation')
    return NextResponse.json({ ok: true, outputClaim: outputClaim.toString() });
  } catch (e) {
    console.error('Error verifying presentation', e);
    return NextResponse.json({ ok: false, error: 'verification_failed' }, { status: 500 });
  }
}
