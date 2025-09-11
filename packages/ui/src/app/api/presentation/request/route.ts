import { NextResponse } from 'next/server'
import { PresentationRequest } from 'mina-attestations'
import { Field } from 'o1js'
import { ageMoreThan18Spec } from 'anon-aadhaar-o1js'

export async function POST() {
  try {
    const spec = await ageMoreThan18Spec()
    const now = new Date()
    const currentDay = Field.from(now.getUTCDate())
    const currentMonth = Field.from(now.getUTCMonth() + 1)
    const currentYear = Field.from(now.getUTCFullYear())

    const request = PresentationRequest.https(
      spec,
      {
        currentDay,
        currentMonth,
        currentYear,
      },
      { action: 'anon-aadhaar:age-check' }
    )
    console.log(
      `currentDay: ${currentDay.toString()}, currentMonth: ${currentMonth.toString()}, currentYear: ${currentYear.toString()}`
    )
    const requestJson = PresentationRequest.toJSON(request)
    return NextResponse.json({ requestJson })
  } catch (e) {
    console.error('Error creating presentation request', e)
    return NextResponse.json(
      { error: 'failed_to_create_request' },
      { status: 500 }
    )
  }
}
