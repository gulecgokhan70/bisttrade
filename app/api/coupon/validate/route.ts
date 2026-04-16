export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ valid: false, error: 'Kupon kodu giriniz' });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ valid: false, error: 'Geçersiz kupon kodu' });
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: 'Kupon kodunun süresi dolmuş' });
    }

    if (coupon.currentUses >= coupon.maxUses) {
      return NextResponse.json({ valid: false, error: 'Kupon kodu kullanım limiti dolmuş' });
    }

    return NextResponse.json({
      valid: true,
      discountPercent: coupon.discountPercent,
      durationDays: coupon.durationDays,
    });
  } catch (error) {
    console.error('Coupon validate error:', error);
    return NextResponse.json({ valid: false, error: 'Bir hata oluştu' }, { status: 500 });
  }
}
