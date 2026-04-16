export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
    }

    const { code } = await request.json()
    if (!code) {
      return NextResponse.json({ error: 'Kupon kodu gerekli' }, { status: 400 })
    }

    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: 'Geçersiz kupon kodu' }, { status: 400 })
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Kupon süresi dolmuş' }, { status: 400 })
    }
    if (coupon.currentUses >= coupon.maxUses) {
      return NextResponse.json({ error: 'Kupon kullanım limiti dolmuş' }, { status: 400 })
    }

    const existingUsage = await prisma.couponUsage.findUnique({
      where: { userId_couponId: { userId: (session?.user as any)?.id, couponId: coupon.id } },
    })
    if (existingUsage) {
      return NextResponse.json({ error: 'Bu kuponu zaten kullandınız' }, { status: 400 })
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
        message: `Premium ${coupon.durationDays} gün aktif edildi!`,
        expiresAt: expiresAt.toISOString(),
      })
    }

    // For partial discount coupons, return discount info
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
      message: `%${coupon.discountPercent} indirim uygulandı`,
      requiresPayment: true,
    })
  } catch (error) {
    console.error('Coupon redeem error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
