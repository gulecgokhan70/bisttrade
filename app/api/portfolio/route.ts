export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { fetchMultiSourceBulkQuotes } from '@/lib/multi-source-finance'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const guestId = searchParams?.get('guestId') ?? ''

    let userId: string | null = null
    if (session?.user) {
      userId = (session.user as any)?.id
    } else if (guestId) {
      const guestUser = await prisma.user.findUnique({ where: { id: guestId } })
      if (guestUser?.isGuest) userId = guestId
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: { stock: true },
    })

    // Fetch live prices for all holding stocks
    const liveQuotes = new Map<string, number>()
    if (holdings.length > 0) {
      try {
        const yahooSymbols = holdings.map((h: any) => h?.stock?.yahooSymbol || `${h?.stock?.symbol}.IS`)
        const quotes = await fetchMultiSourceBulkQuotes(yahooSymbols)
        for (const h of holdings) {
          const ySym = h?.stock?.yahooSymbol || `${h?.stock?.symbol}.IS`
          const quote = quotes.get(ySym)
          if (quote && quote.currentPrice > 0) {
            liveQuotes.set(h.stock.symbol, quote.currentPrice)
          }
        }
      } catch (_e: any) {
        // Live fetch failed, will fall back to DB prices
      }
    }

    const holdingsWithPnL = (holdings ?? []).map((h: any) => {
      // Use live price if available, otherwise fall back to DB price
      const livePrice = liveQuotes.get(h?.stock?.symbol)
      const currentPrice = livePrice ?? h?.stock?.currentPrice ?? 0
      const currentValue = currentPrice * (h?.quantity ?? 0)
      const costBasis = (h?.avgBuyPrice ?? 0) * (h?.quantity ?? 0)
      const pnl = currentValue - costBasis
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0
      return {
        ...h,
        stock: { ...h.stock, currentPrice },
        currentValue: parseFloat(currentValue.toFixed(2)),
        costBasis: parseFloat(costBasis.toFixed(2)),
        pnl: parseFloat(pnl.toFixed(2)),
        pnlPercent: parseFloat(pnlPercent.toFixed(2)),
      }
    })

    const totalHoldingsValue = holdingsWithPnL.reduce((sum: number, h: any) => sum + (h?.currentValue ?? 0), 0)
    const totalCostBasis = holdingsWithPnL.reduce((sum: number, h: any) => sum + (h?.costBasis ?? 0), 0)
    const totalPnL = totalHoldingsValue - totalCostBasis
    const cashBalance = user?.cashBalance ?? 100000
    const totalPortfolioValue = cashBalance + totalHoldingsValue

    return NextResponse.json({
      cashBalance,
      totalHoldingsValue: parseFloat(totalHoldingsValue.toFixed(2)),
      totalPortfolioValue: parseFloat(totalPortfolioValue.toFixed(2)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      totalPnLPercent: totalCostBasis > 0 ? parseFloat(((totalPnL / totalCostBasis) * 100).toFixed(2)) : 0,
      holdings: holdingsWithPnL,
    })
  } catch (error: any) {
    console.error('Portfolio API error:', error)
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 })
  }
}
