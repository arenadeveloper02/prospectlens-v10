import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Maximum function budget on Vercel Pro/Enterprise. Hobby caps at 10s and
// ignores this value entirely — the project must be on Pro or higher.
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'prospect-lens-console',
    time: new Date().toISOString(),
  });
}
