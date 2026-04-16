export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import { calculateTakasAnalysis } from '@/lib/takas-analysis'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get('symbol')
    const period = searchParams.get('period') || '3M'

    if (!symbol) {
      return NextResponse.json({ error: 'Hisse sembolü gerekli' }, { status: 400 })
    }

    // Find the stock
    const stock = await prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() }
    })

    if (!stock) {
      return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })
    }

    const yahooSymbol = stock.yahooSymbol || `${stock.symbol}.IS`

    // For short periods (1G, 1H), we still need enough daily bars for indicators (MFI-14, CMF-20)
    // So we fetch 1M of daily data and let the analysis trim appropriately
    const fetchPeriod = (period === '1G' || period === '1H') ? '1M' : period

    // Fetch OHLCV data from Yahoo
    const history = await fetchYahooHistory(yahooSymbol, fetchPeriod)

    if (!history || history.length < 20) {
      return NextResponse.json({ error: 'Yeterli geçmiş veri bulunamadı (min 20 gün)' }, { status: 400 })
    }

    // Format for takas analysis
    const ohlcv = history.map(h => ({
      date: h.timestamp.toISOString().split('T')[0],
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      volume: Number(h.volume ?? 0)
    }))

    const analysis = calculateTakasAnalysis(ohlcv, stock.symbol, period)

    return NextResponse.json({
      ...analysis,
      stockName: stock.name,
      currentPrice: stock.currentPrice,
      previousClose: stock.previousClose,
    })
  } catch (error) {
    console.error('Takas analysis error:', error)
    return NextResponse.json({ error: 'Takas analizi hesaplanamadı' }, { status: 500 })
  }
}
