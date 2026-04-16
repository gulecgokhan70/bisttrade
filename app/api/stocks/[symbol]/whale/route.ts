export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import { analyzeWhaleActivity, WhaleMode } from '@/lib/whale-analysis'

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params?.symbol ?? ''
    const url = new URL(request.url)
    const periodParam = url.searchParams.get('period') || 'daily'
    const mode: WhaleMode = periodParam === 'intraday' ? 'intraday' : 'daily'

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })

    const yahooSym = stock.yahooSymbol || `${stock.symbol}.IS`

    // Intraday: 5m mumlar (bugünün verisi), Daily: günlük mumlar (3 ay)
    const yahooPeriod = mode === 'intraday' ? '1D' : '3M'
    const history = await fetchYahooHistory(yahooSym, yahooPeriod)

    const minBars = mode === 'intraday' ? 4 : 20
    if (!history || history.length < minBars) {
      return NextResponse.json({
        error: mode === 'intraday'
          ? 'Gün içi veri yetersiz — borsa açıkken tekrar deneyin'
          : 'Yeterli veri yok'
      }, { status: 400 })
    }

    const ohlcv = history.map(h => {
      let dateStr: string
      if (mode === 'intraday') {
        const ist = new Date(h.timestamp.getTime())
        dateStr = ist.toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' }).slice(0, 16)
      } else {
        dateStr = h.timestamp.toISOString().split('T')[0]
      }
      return {
        date: dateStr,
        open: h.open, high: h.high, low: h.low, close: h.close,
        volume: Number(h.volume ?? 0),
      }
    })

    const analysis = analyzeWhaleActivity(ohlcv, stock.symbol, mode)

    return NextResponse.json({
      ...analysis,
      mode,
      stockName: stock.name,
      currentPrice: stock.currentPrice,
    })
  } catch (error) {
    console.error('Whale analysis error:', error)
    return NextResponse.json({ error: 'Balina analizi yapılamadı' }, { status: 500 })
  }
}
