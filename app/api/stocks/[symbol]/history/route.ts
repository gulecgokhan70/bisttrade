export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import { fetchBigparaHistory } from '@/lib/bigpara-finance'

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

    // 1) Yahoo Finance (birincil kaynak)
    if (stock.yahooSymbol) {
      try {
        const yahooHistory = await fetchYahooHistory(stock.yahooSymbol, period)
        if (yahooHistory.length > 0) {
          return NextResponse.json(formatHistory('yahoo', yahooHistory))
        }
      } catch (e) {
        console.warn('Yahoo history failed, trying Bigpara...', e)
      }
    }

    // 2) Bigpara (ikincil kaynak — gerçek grafik verisi)
    try {
      const bigparaHistory = await fetchBigparaHistory(symbol, period)
      if (bigparaHistory.length > 0) {
        return NextResponse.json(formatHistory('bigpara', bigparaHistory))
      }
    } catch (e) {
      console.warn('Bigpara history failed, trying DB...', e)
    }

    // 3) Veritabanı (son çare)
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

    let history = await prisma.priceHistory.findMany({
      where: {
        stockId: stock.id,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
    })

    // 1D veya 1W boş dönerse daha geniş aralıkta dene
    if (history.length === 0 && (period === '1D' || period === '1W')) {
      const extendedSince = new Date()
      extendedSince.setDate(extendedSince.getDate() - 30)
      history = await prisma.priceHistory.findMany({
        where: {
          stockId: stock.id,
          timestamp: { gte: extendedSince },
        },
        orderBy: { timestamp: 'asc' },
        take: period === '1D' ? 100 : 500,
      })
    }

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Geçmiş verileri alınamadı' }, { status: 500 })
  }
}