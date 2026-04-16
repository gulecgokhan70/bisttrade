export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Giri\u015F yapman\u0131z gerekiyor' }, { status: 401 })
    }

    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Kupon kodu gerekli' }, { status: 400 })
    }

    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
    if (!coupon) {
      return NextResponse.json({ error: 'Ge\u00E7ersiz kupon kodu' }, { status: 404 })
    }
    if (!coupon.isActive) {
      return NextResponse.json({ error: 'Bu kupon kodu aktif de\u011Fil' }, { status: 400 })
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Bu kupon kodunun s\u00FCresi dolmu\u015F' }, { status: 400 })
    }
    if (coupon.currentUses >= coupon.maxUses) {
      return NextResponse.json({ error: 'Bu kupon kodu kullan\u0131m limitine ula\u015Fm\u0131\u015F' }, { status: 400 })
    }

    // Check if user already used this coupon
    const existingUsage = await prisma.couponUsage.findUnique({
      where: { userId_couponId: { userId: (session?.user as any)?.id, couponId: coupon.id } },
    })
    if (existingUsage) {
      return NextResponse.json({ error: 'Bu kuponu zaten kulland\u0131n\u0131z' }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      discountPercent: coupon.discountPercent,
      durationDays: coupon.durationDays,
      message: coupon.discountPercent === 100
        ? `${coupon.durationDays} g\u00FCn \u00FCcretsiz Premium!`
        : `%${coupon.discountPercent} indirim, ${coupon.durationDays} g\u00FCn`,
    })
  } catch (error) {
    console.error('Coupon validate error:', error)
    return NextResponse.json({ error: 'Bir hata olu\u015Ftu' }, { status: 500 })
  }
}
