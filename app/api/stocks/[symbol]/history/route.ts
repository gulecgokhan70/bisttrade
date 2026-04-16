export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams?.get('period') ?? '1M'
    const symbol = params?.symbol ?? ''

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) {
      return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })
    }

    const formatHistory = (source: string, data: Array<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }>) =>
      data.map((h) => ({
        id: `${source}-${h.timestamp.getTime()}`,
        stockId: stock.id,
        price: h.close,
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: Number(h.volume ?? 0),
        timestamp: h.timestamp.toISOString(),
        source,
      }))

    // Yahoo Finance is the single source for ALL periods
    if (stock.yahooSymbol) {
      const yahooHistory = await fetchYahooHistory(stock.yahooSymbol, period)
      if (yahooHistory.length > 0) {
        return NextResponse.json(formatHistory('yahoo', yahooHistory))
      }
    }

    // Last resort: DB history
    let daysBack = 30
    switch (period) {
      case '1D': daysBack = 1; break
      case '1W': daysBack = 7; break
      case '1M': daysBack = 30; break
      case '3M': daysBack = 90; break
      case '1Y': daysBack = 365; break
      case '5Y': daysBack = 1825; break
      default: daysBack = 30
    }

    const since = new Date()
    since.setDate(since.getDate() - daysBack)

    const history = await prisma.priceHistory.findMany({
      where: {
        stockId: stock.id,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
    })

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Geçmiş verileri alınamadı' }, { status: 500 })
  }
}