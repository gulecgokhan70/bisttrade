export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

function isBISTOpen(): boolean {
  const now = new Date()
  const istanbulStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })
  const istanbul = new Date(istanbulStr)
  const day = istanbul.getDay()
  if (day === 0 || day === 6) return false
  const mins = istanbul.getHours() * 60 + istanbul.getMinutes()
  return mins >= 600 && mins <= 1090 // 10:00 - 18:10
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { symbol, quantity, type, orderType = 'MARKET', limitPrice, stopPrice, trailingPercent, guestId } = body ?? {}

    if (!symbol || !quantity || !type) {
      return NextResponse.json({ error: 'Gerekli alanlar eksik' }, { status: 400 })
    }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Geçersiz miktar' }, { status: 400 })
    }

    // Determine user
    let userId: string | null = null
    if (session?.user) {
      userId = (session.user as any)?.id
    } else if (guestId) {
      const guestUser = await prisma.user.findUnique({ where: { id: guestId } })
      if (guestUser?.isGuest) userId = guestId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Yetkilendirme gerekli' }, { status: 401 })
    }

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) {
      return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    // For non-market orders, create a pending order
    if (orderType !== 'MARKET') {
      const orderData: any = {
        userId,
        stockId: stock.id,
        type,
        orderType,
        quantity: qty,
        status: 'PENDING',
      }

      if (orderType === 'LIMIT') {
        if (!limitPrice) return NextResponse.json({ error: 'Limit fiyatı gerekli' }, { status: 400 })
        orderData.limitPrice = parseFloat(limitPrice)
      } else if (orderType === 'STOP_LOSS') {
        if (!stopPrice) return NextResponse.json({ error: 'Stop fiyatı gerekli' }, { status: 400 })
        orderData.stopPrice = parseFloat(stopPrice)
      } else if (orderType === 'STOP_LIMIT') {
        if (!stopPrice || !limitPrice) return NextResponse.json({ error: 'Stop ve limit fiyatları gerekli' }, { status: 400 })
        orderData.stopPrice = parseFloat(stopPrice)
        orderData.limitPrice = parseFloat(limitPrice)
      } else if (orderType === 'TRAILING_STOP') {
        if (type !== 'SELL') return NextResponse.json({ error: 'Takip Eden Stop sadece satış emirlerinde kullanılabilir' }, { status: 400 })
        if (!trailingPercent) return NextResponse.json({ error: 'Takip yüzdesini girin' }, { status: 400 })
        orderData.trailingPercent = parseFloat(trailingPercent)
        orderData.stopPrice = stock.currentPrice * (1 - parseFloat(trailingPercent) / 100)
      }

      // Set expiry to end of trading day (or 24h from now)
      const expiry = new Date()
      expiry.setHours(expiry.getHours() + 24)
      orderData.expiresAt = expiry

      const order = await prisma.order.create({ data: orderData })
      return NextResponse.json({
        success: true,
        message: `${type === 'BUY' ? 'Alım' : 'Satım'} emri oluşturuldu (${orderType})`,
        order,
      })
    }

    // MARKET order - if market is closed, save as pending order
    if (!isBISTOpen()) {
      const expiry = new Date()
      // Expire after next trading day end (give ~48h for weekends)
      expiry.setHours(expiry.getHours() + 48)
      const order = await prisma.order.create({
        data: {
          userId,
          stockId: stock.id,
          type,
          orderType: 'MARKET',
          quantity: qty,
          status: 'PENDING',
          expiresAt: expiry,
        },
      })
      return NextResponse.json({
        success: true,
        message: `${type === 'BUY' ? 'Alım' : 'Satım'} emri oluşturuldu — Borsa açılınca piyasa fiyatından gerçekleştirilecek`,
        order,
        pendingUntilOpen: true,
      })
    }

    // MARKET order - execute immediately
    const totalAmount = parseFloat((stock.currentPrice * qty).toFixed(2))

    if (type === 'BUY') {
      if ((user?.cashBalance ?? 0) < totalAmount) {
        return NextResponse.json({ error: 'Yetersiz bakiye' }, { status: 400 })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { cashBalance: { decrement: totalAmount } },
      })

      const existingHolding = await prisma.holding.findUnique({
        where: { userId_stockId: { userId, stockId: stock.id } },
      })

      if (existingHolding) {
        const newQty = (existingHolding?.quantity ?? 0) + qty
        const rawAvg = (((existingHolding?.avgBuyPrice ?? 0) * (existingHolding?.quantity ?? 0)) + totalAmount) / newQty
        const newAvgPrice = parseFloat(rawAvg.toFixed(2))
        await prisma.holding.update({
          where: { id: existingHolding.id },
          data: { quantity: newQty, avgBuyPrice: newAvgPrice },
        })
      } else {
        await prisma.holding.create({
          data: {
            userId,
            stockId: stock.id,
            quantity: qty,
            avgBuyPrice: stock.currentPrice,
          },
        })
      }
    } else if (type === 'SELL') {
      const holding = await prisma.holding.findUnique({
        where: { userId_stockId: { userId, stockId: stock.id } },
      })

      if (!holding || (holding?.quantity ?? 0) < qty) {
        return NextResponse.json({ error: 'Yetersiz hisse' }, { status: 400 })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { cashBalance: { increment: totalAmount } },
      })

      const newQty = (holding?.quantity ?? 0) - qty
      if (newQty <= 0) {
        await prisma.holding.delete({ where: { id: holding.id } })
      } else {
        await prisma.holding.update({
          where: { id: holding.id },
          data: { quantity: newQty },
        })
      }
    } else {
      return NextResponse.json({ error: 'Geçersiz işlem tipi' }, { status: 400 })
    }

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId,
        stockId: stock.id,
        type,
        orderType: 'MARKET',
        quantity: qty,
        price: stock.currentPrice,
        totalAmount,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${type === 'BUY' ? 'Alım' : 'Satım'} emri gerçekleştirildi`,
    })
  } catch (error: any) {
    console.error('Trade API error:', error)
    return NextResponse.json({ error: 'İşlem başarısız oldu' }, { status: 500 })
  }
}
