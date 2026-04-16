export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { activateCoupon } from '@/lib/subscription';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Kupon kodu giriniz' }, { status: 400 });
    }

    const result = await activateCoupon(session.user.id, code);

    const isUnlimited = result.durationDays >= 99999;
    const msg = isUnlimited
      ? 'Premium üyelik süresiz olarak aktif edildi!'
      : `Premium üyelik ${result.durationDays} gün için aktif edildi!`;

    return NextResponse.json({
      success: true,
      message: msg,
      expiresAt: result.expiresAt,
      durationDays: result.durationDays,
      isUnlimited,
    });
  } catch (error: any) {
    console.error('Coupon apply error:', error);
    return NextResponse.json({ error: error.message || 'Kupon uygulanamadı' }, { status: 400 });
  }
}
