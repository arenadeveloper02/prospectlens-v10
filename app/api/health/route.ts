import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'prospect-lens-console',
    time: new Date().toISOString(),
  });
}
