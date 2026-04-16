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
    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: 'Ge\u00E7ersiz kupon kodu' }, { status: 400 })
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Kupon s\u00FCresi dolmu\u015F' }, { status: 400 })
    }
    if (coupon.currentUses >= coupon.maxUses) {
      return NextResponse.json({ error: 'Kupon kullan\u0131m limiti dolmu\u015F' }, { status: 400 })
    }

    const existingUsage = await prisma.couponUsage.findUnique({
      where: { userId_couponId: { userId: (session?.user as any)?.id, couponId: coupon.id } },
    })
    if (existingUsage) {
      return NextResponse.json({ error: 'Bu kuponu zaten kulland\u0131n\u0131z' }, { status: 400 })
    }

    // For 100% discount coupons, activate premium directly
    if (coupon.discountPercent === 100) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + coupon.durationDays)

      await prisma.$transaction([
        prisma.user.update({
          where: { id: (session?.user as any)?.id },
          data: {
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: expiresAt,
          },
        }),
        prisma.subscription.create({
          data: {
            userId: (session?.user as any)?.id,
            plan: 'COUPON',
            status: 'ACTIVE',
            couponCode: coupon.code,
            currentPeriodStart: new Date(),
            currentPeriodEnd: expiresAt,
          },
        }),
        prisma.coupon.update({
          where: { id: coupon.id },
          data: { currentUses: { increment: 1 } },
        }),
        prisma.couponUsage.create({
          data: { userId: (session?.user as any)?.id, couponId: coupon.id },
        }),
      ])

      return NextResponse.json({
        success: true,
        message: `Premium ${coupon.durationDays} g\u00FCn aktif edildi!`,
        expiresAt: expiresAt.toISOString(),
      })
    }

    // For partial discount coupons, return discount info for Stripe checkout
    await prisma.$transaction([
      prisma.coupon.update({
        where: { id: coupon.id },
        data: { currentUses: { increment: 1 } },
      }),
      prisma.couponUsage.create({
        data: { userId: (session?.user as any)?.id, couponId: coupon.id },
      }),
    ])

    return NextResponse.json({
      success: true,
      discountPercent: coupon.discountPercent,
      message: `%${coupon.discountPercent} indirim uyguland\u0131`,
      requiresPayment: true,
    })
  } catch (error) {
    console.error('Coupon redeem error:', error)
    return NextResponse.json({ error: 'Bir hata olu\u015Ftu' }, { status: 500 })
  }
}
