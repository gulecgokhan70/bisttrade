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

    // 1) Yahoo Finance (birincil kaynak)
    if (stock.yahooSymbol) {
      const yahooHistory = await fetchYahooHistory(stock.yahooSymbol, period)
      if (yahooHistory.length > 0) {
        return NextResponse.json(formatHistory('yahoo', yahooHistory))
      }
    }

    // 2) Veritabanı (son çare)
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

    // Hâlâ veri yoksa mevcut fiyattan simüle edilmiş grafik oluştur
    if (history.length === 0 && stock.currentPrice && stock.currentPrice > 0) {
      const basePrice = Number(stock.currentPrice)
      const now = new Date()
      const simulated: any[] = []
      const pointCount = period === '1D' ? 78 : period === '1W' ? 200 : 60
      const intervalMs = period === '1D' ? 5 * 60 * 1000 : period === '1W' ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000
      // Seed: hisse sembolünden deterministik değer
      let seed = 0
      for (let c = 0; c < symbol.length; c++) seed += symbol.charCodeAt(c)
      
      for (let i = 0; i < pointCount; i++) {
        // Basit deterministik dalgalanma (random yerine sin tabanlı)
        const wave = Math.sin(seed + i * 0.3) * 0.008 + Math.sin(seed + i * 0.7) * 0.005 + Math.cos(seed + i * 0.15) * 0.01
        const drift = (i / pointCount) * 0.02 - 0.01 // hafif trend
        const price = basePrice * (1 + wave + drift)
        const variation = basePrice * 0.003
        const ts = new Date(now.getTime() - (pointCount - i) * intervalMs)
        
        simulated.push({
          id: `sim-${ts.getTime()}`,
          stockId: stock.id,
          price: parseFloat(price.toFixed(2)),
          open: parseFloat((price - variation * Math.sin(seed + i)).toFixed(2)),
          high: parseFloat((price + Math.abs(variation * Math.cos(seed + i * 0.5))).toFixed(2)),
          low: parseFloat((price - Math.abs(variation * Math.sin(seed + i * 0.8))).toFixed(2)),
          close: parseFloat(price.toFixed(2)),
          volume: Math.floor(50000 + Math.abs(Math.sin(seed + i * 0.4)) * 200000),
          timestamp: ts.toISOString(),
          source: 'simulated',
        })
      }
      return NextResponse.json(simulated)
    }

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('History API error:', error)
    return NextResponse.json({ error: 'Geçmiş verileri alınamadı' }, { status: 500 })
  }
}