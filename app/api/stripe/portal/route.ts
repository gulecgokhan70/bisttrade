export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Stripe portal kaldırılmıştır.' },
    { status: 410 }
  );
}
