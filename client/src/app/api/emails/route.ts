import { NextResponse } from 'next/server'
import { emails } from '../webhook/inbound-store/route'

export async function GET() {
  return NextResponse.json({
    count: emails.length,
    emails: emails.slice(-50)
  })
}