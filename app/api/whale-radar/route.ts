export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import { analyzeWhaleActivity } from '@/lib/whale-analysis'

// Cache whale radar results for 5 minutes
let radarCache: { data: any; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  try {
    // Check cache
    if (radarCache && Date.now() - radarCache.timestamp < CACHE_TTL) {
      return NextResponse.json(radarCache.data)
    }

    // Get active stocks
    const stocks = await prisma.stock.findMany({
      where: { isActive: true },
      select: { symbol: true, name: true, yahooSymbol: true, currentPrice: true },
    })

    // Analyze in batches of 15
    const results: Array<{
      symbol: string
      name: string
      price: number
      whaleScore: number
      level: string
      trend: string
      netFlow: number
      recentActivity: string
      accDays: number
      distDays: number
      volumeRatio: number
    }> = []

    const BATCH_SIZE = 15
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const batch = stocks.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map(async (stock) => {
          const yahooSym = stock.yahooSymbol || `${stock.symbol}.IS`
          try {
            const history = await fetchYahooHistory(yahooSym, '1M')
            if (!history || history.length < 20) return null

            const ohlcv = history.map(h => ({
              date: h.timestamp.toISOString().split('T')[0],
              open: h.open, high: h.high, low: h.low, close: h.close,
              volume: Number(h.volume ?? 0),
            }))

            const analysis = analyzeWhaleActivity(ohlcv, stock.symbol)
            return {
              symbol: stock.symbol,
              name: stock.name || stock.symbol,
              price: stock.currentPrice ?? 0,
              whaleScore: analysis.whaleScore.score,
              level: analysis.whaleScore.level,
              trend: analysis.whaleScore.trend,
              netFlow: analysis.netWhaleFlow,
              recentActivity: analysis.recentActivity,
              accDays: analysis.accumulationDays,
              distDays: analysis.distributionDays,
              volumeRatio: analysis.volumeRatio,
            }
          } catch {
            return null
          }
        })
      )

      for (const r of batchResults) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      }

      if (i + BATCH_SIZE < stocks.length) {
        await new Promise(res => setTimeout(res, 200))
      }
    }

    // Sort by whale score descending, take top 15
    results.sort((a, b) => b.whaleScore - a.whaleScore)
    const top = results.slice(0, 15)

    const response = {
      stocks: top,
      totalAnalyzed: results.length,
      timestamp: new Date().toISOString(),
    }

    radarCache = { data: response, timestamp: Date.now() }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Whale radar error:', error)
    return NextResponse.json({ error: 'Balina radarı hesaplanamadı' }, { status: 500 })
  }
}
