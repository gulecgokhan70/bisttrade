export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET: List user's auto-trade strategies
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const guestId = searchParams?.get('guestId') ?? ''
    const userId = (session?.user as any)?.id || guestId

    if (!userId) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    const strategies = await prisma.autoStrategy.findMany({
      where: { userId },
      include: { stock: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(strategies)
  } catch (error: any) {
    console.error('Auto-trade GET error:', error)
    return NextResponse.json({ error: 'Stratejiler alınamadı' }, { status: 500 })
  }
}

// POST: Create new auto-trade strategy
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { symbol, strategy, maxAmount, maxQuantity, guestId, mode, isFullAuto, budgetPercent, maxOpenPositions } = body
    const userId = (session?.user as any)?.id || guestId

    if (!userId) {
      return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 })
    }

    // Full Auto mode - no stock required
    if (isFullAuto) {
      if (!budgetPercent || budgetPercent < 1 || budgetPercent > 10) {
        return NextResponse.json({ error: 'Bütçe oranı %1-%10 arasında olmalı' }, { status: 400 })
      }

      // Check existing full auto strategy
      const existing = await prisma.autoStrategy.findFirst({
        where: { userId, isFullAuto: true },
      })
      if (existing) {
        return NextResponse.json({ error: 'Zaten bir tam otomatik strateji mevcut. Önce mevcut olanı silin.' }, { status: 409 })
      }

      const autoStrategy = await prisma.autoStrategy.create({
        data: {
          userId,
          stockId: null,
          strategy: strategy ?? 'COMBINED',
          mode: mode ?? 'aggressive',
          isFullAuto: true,
          budgetPercent: budgetPercent,
          maxAmount: maxAmount ?? 50000,
          maxQuantity: maxQuantity ?? 100,
          maxOpenPositions: maxOpenPositions ?? 5,
        },
        include: { stock: true },
      })

      return NextResponse.json(autoStrategy)
    }

    // Normal mode - stock required
    if (!symbol || !strategy) {
      return NextResponse.json({ error: 'Sembol ve strateji gerekli' }, { status: 400 })
    }

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) {
      return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })
    }

    // Check for existing strategy
    const existing = await prisma.autoStrategy.findFirst({
      where: { userId, stockId: stock.id, strategy },
    })
    if (existing) {
      return NextResponse.json({ error: 'Bu strateji zaten mevcut' }, { status: 409 })
    }

    const autoStrategy = await prisma.autoStrategy.create({
      data: {
        userId,
        stockId: stock.id,
        strategy,
        mode: mode ?? 'normal',
        maxAmount: maxAmount ?? 50000,
        maxQuantity: maxQuantity ?? 100,
      },
      include: { stock: true },
    })

    return NextResponse.json(autoStrategy)
  } catch (error: any) {
    console.error('Auto-trade POST error:', error)
    return NextResponse.json({ error: 'Strateji oluşturulamadı' }, { status: 500 })
  }
}

// DELETE: Remove auto-trade strategy
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const id = searchParams?.get('id') ?? ''
    const guestId = searchParams?.get('guestId') ?? ''
    const userId = (session?.user as any)?.id || guestId

    if (!userId || !id) {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
    }

    await prisma.autoStrategy.delete({
      where: { id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Auto-trade DELETE error:', error)
    return NextResponse.json({ error: 'Strateji silinemedi' }, { status: 500 })
  }
}

// PATCH: Toggle strategy active/inactive or update settings
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { id, isActive, guestId, mode, budgetPercent, maxOpenPositions } = body
    const userId = (session?.user as any)?.id || guestId

    if (!userId || !id) {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
    }

    const updateData: any = {}
    if (typeof isActive === 'boolean') updateData.isActive = isActive
    if (mode) updateData.mode = mode
    if (budgetPercent !== undefined && budgetPercent >= 1 && budgetPercent <= 10) {
      updateData.budgetPercent = budgetPercent
    }
    if (maxOpenPositions !== undefined && maxOpenPositions >= 1 && maxOpenPositions <= 15) {
      updateData.maxOpenPositions = maxOpenPositions
    }

    const updated = await prisma.autoStrategy.update({
      where: { id, userId },
      data: updateData,
      include: { stock: true },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Auto-trade PATCH error:', error)
    return NextResponse.json({ error: 'Strateji güncellenemedi' }, { status: 500 })
  }
}
