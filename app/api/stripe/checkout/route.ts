export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Stripe ödeme sistemi kaldırılmıştır. Lütfen kupon kodu kullanın veya Google Play üzerinden abone olun.' },
    { status: 410 }
  );
}
