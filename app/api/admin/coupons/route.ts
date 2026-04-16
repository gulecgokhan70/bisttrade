export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

// GET - List all coupons (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: (session?.user as any)?.id } })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
    }

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { usages: true } } },
    })
    return NextResponse.json(coupons)
  } catch (error) {
    console.error('Coupon list error:', error)
    return NextResponse.json({ error: 'Hata' }, { status: 500 })
  }
}

// POST - Create coupon (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: (session?.user as any)?.id } })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
    }

    const body = await request.json()
    const { code, discountPercent, durationDays, maxUses, expiresAt } = body

    if (!code) {
      return NextResponse.json({ error: 'Kupon kodu gerekli' }, { status: 400 })
    }

    const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Bu kupon kodu zaten mevcut' }, { status: 400 })
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        discountPercent: discountPercent ?? 100,
        durationDays: durationDays ?? 30,
        maxUses: maxUses ?? 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    })

    return NextResponse.json(coupon)
  } catch (error) {
    console.error('Coupon create error:', error)
    return NextResponse.json({ error: 'Hata' }, { status: 500 })
  }
}

// DELETE - Delete coupon (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: (session?.user as any)?.id } })
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
    }

    const { id } = await request.json()
    await prisma.coupon.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Coupon delete error:', error)
    return NextResponse.json({ error: 'Hata' }, { status: 500 })
  }
}
