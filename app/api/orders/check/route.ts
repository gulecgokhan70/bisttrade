export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooQuote } from '@/lib/yahoo-finance'

function isBISTOpen(): boolean {
  const now = new Date()
  const istanbulStr = now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })
  const istanbul = new Date(istanbulStr)
  const day = istanbul.getDay()
  if (day === 0 || day === 6) return false
  const mins = istanbul.getHours() * 60 + istanbul.getMinutes()
  return mins >= 600 && mins <= 1090 // 10:00 - 18:10
}

// Check and execute pending orders
export async function POST() {
  try {
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'PENDING' },
      include: { stock: true, user: true },
    })

    let executedCount = 0
    let expiredCount = 0

    // Pre-fetch Yahoo prices for all unique stocks in pending orders
    const uniqueStocks = new Map<string, { yahooSymbol: string; dbPrice: number }>()
    for (const order of pendingOrders) {
      if (order.stock.yahooSymbol && !uniqueStocks.has(order.stockId)) {
        uniqueStocks.set(order.stockId, {
          yahooSymbol: order.stock.yahooSymbol,
          dbPrice: order.stock.currentPrice,
        })
      }
    }

    const livePrices = new Map<string, number>()
    const pricePromises = Array.from(uniqueStocks.entries()).map(async ([stockId, info]) => {
      try {
        const quote = await fetchYahooQuote(info.yahooSymbol)
        if (quote && quote.currentPrice > 0) {
          livePrices.set(stockId, quote.currentPrice)
        }
      } catch {}
    })
    await Promise.allSettled(pricePromises)

    for (const order of pendingOrders) {
      // Check expiry
      if (order.expiresAt && new Date() > order.expiresAt) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'EXPIRED' },
        })
        expiredCount++
        continue
      }

      // Use Yahoo live price, fall back to DB price
      const currentPrice = livePrices.get(order.stockId) ?? order.stock.currentPrice
      let shouldExecute = false
      let executionPrice = currentPrice

      switch (order.orderType) {
        case 'MARKET':
          // Market orders placed when market was closed — execute when market opens
          if (isBISTOpen()) {
            shouldExecute = true
          }
          break

        case 'LIMIT':
          if (order.type === 'BUY' && currentPrice <= (order.limitPrice ?? 0)) {
            shouldExecute = true
            executionPrice = order.limitPrice ?? currentPrice
          } else if (order.type === 'SELL' && currentPrice >= (order.limitPrice ?? 0)) {
            shouldExecute = true
            executionPrice = order.limitPrice ?? currentPrice
          }
          break

        case 'STOP_LOSS':
          if (order.type === 'SELL' && currentPrice <= (order.stopPrice ?? 0)) {
            shouldExecute = true
          } else if (order.type === 'BUY' && currentPrice >= (order.stopPrice ?? 0)) {
            shouldExecute = true
          }
          break

        case 'STOP_LIMIT':
          if (order.type === 'SELL' && currentPrice <= (order.stopPrice ?? 0) && currentPrice >= (order.limitPrice ?? 0)) {
            shouldExecute = true
            executionPrice = order.limitPrice ?? currentPrice
          } else if (order.type === 'BUY' && currentPrice >= (order.stopPrice ?? 0) && currentPrice <= (order.limitPrice ?? 0)) {
            shouldExecute = true
            executionPrice = order.limitPrice ?? currentPrice
          }
          break

        case 'TRAILING_STOP':
          const trailPct = (order.trailingPercent ?? 5) / 100
          if (order.type === 'SELL') {
            const newStop = currentPrice * (1 - trailPct)
            if (newStop > (order.stopPrice ?? 0)) {
              // Update trailing stop price
              await prisma.order.update({
                where: { id: order.id },
                data: { stopPrice: parseFloat(newStop.toFixed(2)) },
              })
            } else if (currentPrice <= (order.stopPrice ?? 0)) {
              shouldExecute = true
            }
          } else {
            const newStop = currentPrice * (1 + trailPct)
            if (newStop < (order.stopPrice ?? Infinity)) {
              await prisma.order.update({
                where: { id: order.id },
                data: { stopPrice: parseFloat(newStop.toFixed(2)) },
              })
            } else if (currentPrice >= (order.stopPrice ?? Infinity)) {
              shouldExecute = true
            }
          }
          break
      }

      if (shouldExecute) {
        const totalAmount = parseFloat((executionPrice * order.quantity).toFixed(2))

        if (order.type === 'BUY') {
          if ((order.user.cashBalance ?? 0) < totalAmount) {
            await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
            continue
          }

          await prisma.user.update({
            where: { id: order.userId },
            data: { cashBalance: { decrement: totalAmount } },
          })

          const existingHolding = await prisma.holding.findUnique({
            where: { userId_stockId: { userId: order.userId, stockId: order.stockId } },
          })

          if (existingHolding) {
            const newQty = (existingHolding.quantity ?? 0) + order.quantity
            const rawAvg = (((existingHolding.avgBuyPrice ?? 0) * (existingHolding.quantity ?? 0)) + totalAmount) / newQty
            await prisma.holding.update({
              where: { id: existingHolding.id },
              data: { quantity: newQty, avgBuyPrice: parseFloat(rawAvg.toFixed(2)) },
            })
          } else {
            await prisma.holding.create({
              data: {
                userId: order.userId,
                stockId: order.stockId,
                quantity: order.quantity,
                avgBuyPrice: executionPrice,
              },
            })
          }
        } else {
          const holding = await prisma.holding.findUnique({
            where: { userId_stockId: { userId: order.userId, stockId: order.stockId } },
          })

          if (!holding || (holding.quantity ?? 0) < order.quantity) {
            await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
            continue
          }

          await prisma.user.update({
            where: { id: order.userId },
            data: { cashBalance: { increment: totalAmount } },
          })

          const newQty = (holding.quantity ?? 0) - order.quantity
          if (newQty <= 0) {
            await prisma.holding.delete({ where: { id: holding.id } })
          } else {
            await prisma.holding.update({
              where: { id: holding.id },
              data: { quantity: newQty },
            })
          }
        }

        // Record transaction
        await prisma.transaction.create({
          data: {
            userId: order.userId,
            stockId: order.stockId,
            type: order.type,
            orderType: order.orderType,
            quantity: order.quantity,
            price: executionPrice,
            totalAmount,
          },
        })

        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'EXECUTED', executedAt: new Date() },
        })

        executedCount++
      }
    }

    return NextResponse.json({ executedCount, expiredCount })
  } catch (error: any) {
    console.error('Order check error:', error)
    return NextResponse.json({ error: 'Emir kontrolü başarısız' }, { status: 500 })
  }
}
