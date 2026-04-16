export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchMultiSourceBulkQuotes } from '@/lib/multi-source-finance'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import {
  analyzeEnhancedTechnicals,
  generateMultiTimeframeAnalysis,
  type EnhancedTechnicalData,
  type MultiTimeframeData,
} from '@/lib/technical-indicators'

// Cache for technical data - refreshes every 5 minutes
let techCache: { data: Map<string, EnhancedTechnicalData>; timestamp: number } | null = null
const TECH_CACHE_TTL = 5 * 60 * 1000

// Cache for multi-timeframe data - refreshes every 10 minutes
let mtfCache: { data: Map<string, MultiTimeframeData>; timestamp: number } | null = null
const MTF_CACHE_TTL = 10 * 60 * 1000

const ALL_CATEGORIES = [
  'GÜVENLİ AL',
  'MACD CROSSOVER',
  'AL FIRSATI',
  'DÖNÜŞ FIRSATI',
  'AŞIRI SATIM',
  'GOLDEN CROSS',
  'BOLLINGER DIP',
  'HACİM PATLAMASI',
  'VOLATİL',
  'YÜKSEK HACİM',
  'YÜKSELİŞ',
  'DÜŞÜŞ',
] as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryFilter = searchParams.get('category')

    // 1. Get all active stocks from DB
    const stocks = await prisma.stock.findMany({
      where: { isActive: true },
      select: {
        id: true,
        symbol: true,
        yahooSymbol: true,
        name: true,
        sector: true,
        currentPrice: true,
        previousClose: true,
        dayHigh: true,
        dayLow: true,
        volume: true,
      },
    })

    if (!stocks || stocks.length === 0) {
      return NextResponse.json({ opportunities: [], categories: ALL_CATEGORIES })
    }

    // 2. Fetch LIVE prices
    const yahooSymbols = stocks
      .map(s => s.yahooSymbol)
      .filter((s): s is string => !!s)

    let liveQuotes = new Map<string, any>()
    try {
      liveQuotes = await fetchMultiSourceBulkQuotes(yahooSymbols)
    } catch (e) {
      console.error('Scanner: bulk quote fetch failed, using DB data', e)
    }

    // 3. First pass: score all stocks with basic signals
    const candidates: Array<{
      stock: typeof stocks[0]
      currentPrice: number
      previousClose: number
      dayHigh: number
      dayLow: number
      volume: number
      changePercent: number
      dayRangePercent: number
      score: number
      signals: string[]
      category: string
      source: string
    }> = []

    for (const stock of stocks) {
      const liveData = liveQuotes.get(stock.yahooSymbol ?? '')
      const currentPrice = liveData?.currentPrice ?? stock.currentPrice ?? 0
      const previousClose = liveData?.previousClose ?? stock.previousClose ?? 0
      const dayHigh = liveData?.dayHigh ?? stock.dayHigh ?? 0
      const dayLow = liveData?.dayLow ?? stock.dayLow ?? 0
      const volume = Number(liveData?.volume ?? stock.volume ?? 0)
      const source = liveData ? liveData.source : 'db'

      if (currentPrice <= 0 || previousClose <= 0) continue

      const changePercent = ((currentPrice - previousClose) / previousClose) * 100
      const dayRange = dayHigh - dayLow
      const dayRangePercent = previousClose > 0 ? (dayRange / previousClose) * 100 : 0

      let score = 0
      const signals: string[] = []
      let category = ''

      // -- Momentum signals (daha sıkı eşikler) --
      if (changePercent > 4) {
        score += 3
        signals.push('Güçlü yükselme trendi')
      } else if (changePercent > 2) {
        score += 2
        signals.push('Pozitif momentum')
      }
      if (changePercent < -4) {
        score += 2
        signals.push('Sert düşüş - dönüş potansiyeli')
      }

      // -- Volume signals (daha yüksek eşik) --
      if (volume > 5000000) {
        score += 2
        signals.push('Yüksek hacim')
      } else if (volume > 1000000) {
        score += 1
        signals.push('Ortalama üstü hacim')
      }

      // -- Volatility --
      if (dayRangePercent > 4) {
        score += 2
        signals.push('Yüksek volatilité')
      } else if (dayRangePercent > 2) {
        score += 1
        signals.push('Orta volatilité')
      }

      // -- Price position --
      if (dayRange > 0 && currentPrice <= dayLow + dayRange * 0.15) {
        score += 2
        signals.push('Gün dibi yakını')
      }

      // Base category
      if (changePercent > 2.5 && volume > 1000000) {
        category = 'AL FIRSATI'
      } else if (changePercent < -3 && volume > 1000000) {
        category = 'DÖNÜŞ FIRSATI'
      } else if (dayRangePercent > 3.5) {
        category = 'VOLATİL'
      } else if (volume > 5000000) {
        category = 'YÜKSEK HACİM'
      } else if (changePercent > 1.5) {
        category = 'YÜKSELİŞ'
      } else if (changePercent < -1.5) {
        category = 'DÜŞÜŞ'
      }

      if (score >= 3 && category) {
        candidates.push({
          stock,
          currentPrice,
          previousClose,
          dayHigh,
          dayLow,
          volume,
          changePercent: parseFloat(changePercent.toFixed(2)),
          dayRangePercent: parseFloat(dayRangePercent.toFixed(2)),
          score,
          signals,
          category,
          source,
        })
      }
    }

    candidates.sort((a, b) => b.score - a.score)

    // 4. Second pass: enhanced technicals + multi-timeframe for top candidates
    const topCandidates = candidates.slice(0, 30)
    const yahooSymsList = topCandidates.map(c => c.stock.yahooSymbol ?? '').filter(Boolean)
    
    const [techData, mtfData] = await Promise.all([
      getEnhancedTechnicalData(topCandidates.map(c => ({
        yahooSymbol: c.stock.yahooSymbol ?? '',
        volume: c.volume,
      }))),
      getMultiTimeframeData(yahooSymsList),
    ])

    // 5. Enrich candidates with enhanced technical + multi-timeframe data
    const opportunities: any[] = []
    for (const c of topCandidates) {
      const sym = c.stock.yahooSymbol ?? ''
      const tech = techData.get(sym)
      const mtf = mtfData.get(sym)
      let { score, signals, category } = c

      if (tech) {
        // RSI 70+ -> skip (aşırı alım)
        if (tech.rsi14 !== null && tech.rsi14 >= 70) {
          continue
        }

        // RSI signals
        if (tech.rsiSignal === 'AŞIRI_SATIM') {
          score += 3
          signals.push(`RSI ${tech.rsi14} - Aşırı satım`)
          if (category === 'DÖNÜŞ FIRSATI' || category === 'DÜŞÜŞ') {
            category = 'AŞIRI SATIM'
          }
        } else if (tech.rsi14 !== null) {
          signals.push(`RSI ${tech.rsi14}`)
        }

        // MA signals
        if (tech.maSignal === 'GOLDEN_CROSS') {
          score += 3
          signals.push('Golden Cross (MA20>MA50)')
          if (c.changePercent > 0) category = 'GOLDEN CROSS'
        } else if (tech.maSignal === 'DEATH_CROSS') {
          score += 1
          signals.push('Death Cross (MA20<MA50)')
        } else if (tech.maSignal === 'ABOVE_MA20') {
          score += 1
          signals.push('MA20 üzerinde')
        } else if (tech.maSignal === 'BELOW_MA20') {
          signals.push('MA20 altında')
        }

        // Volume spike
        if (tech.volumeSpike) {
          score += 2
          signals.push('Hacim patlaması')
          if (category === 'YÜKSEK HACİM' || category === 'YÜKSELİŞ') {
            category = 'HACİM PATLAMASI'
          }
        }

        // === NEW: Bollinger Band signals ===
        if (tech.bollinger) {
          if (tech.bollinger.percentB <= 0.1) {
            score += 2
            signals.push(`BB Alt Bandı (%B: ${(tech.bollinger.percentB * 100).toFixed(0)}%)`)
            if (c.changePercent < -1) category = 'BOLLINGER DIP'
          } else if (tech.bollinger.percentB >= 0.9) {
            score -= 1 // near upper band = risky for buy
            signals.push(`BB Üst Band yakını`)
          }
          if (tech.bollinger.squeeze) {
            score += 1
            signals.push('BB Sıkışma (kırılım beklentisi)')
          }
        }

        // === NEW: MACD Crossover signals ===
        if (tech.macdCrossover) {
          if (tech.macdCrossover.crossover === 'BULLISH') {
            score += 3
            signals.push('MACD Yukarı Kesim ↑')
            if (c.changePercent > 0 && tech.confirmingIndicators >= 2) {
              category = 'MACD CROSSOVER'
            }
          } else if (tech.macdCrossover.crossover === 'BEARISH') {
            score -= 2
            signals.push('MACD Aşağı Kesim ↓')
          } else if (tech.macdCrossover.histogram > 0) {
            score += 1
            signals.push('MACD Pozitif')
          } else {
            signals.push('MACD Negatif')
          }
        }

        // === NEW: Güvenli AL - çoklu gösterge doğrulaması ===
        if (tech.confirmingIndicators >= 3 && c.changePercent > 0) {
          score += 3
          category = 'GÜVENLİ AL'
          signals.push(`${tech.confirmingIndicators} gösterge doğrulaması`)
        }
      }

      // Multi-timeframe alignment bonus
      if (mtf) {
        if (mtf.alignment === 'UYUMLU') {
          score += 3
          signals.push(`3 zaman dilimi UYUMLU: ${mtf.consensus}`)
        } else if (mtf.alignment === 'ZİT') {
          score -= 2 // stronger penalty for opposing signals
          signals.push('Zaman dilimleri zıt sinyal')
        }
        if (mtf.weekly.signal === 'AL' && mtf.monthly.signal === 'AL') {
          score += 2
          signals.push('Haftalık+Aylık AL')
        } else if (mtf.weekly.signal === 'SAT' && mtf.monthly.signal === 'SAT') {
          score += 1
          signals.push('Haftalık+Aylık SAT')
        }
      }

      // Calculate reliability
      const confirmingCount = tech?.confirmingIndicators ?? 0
      let reliability: string = 'DÜŞÜK'
      if (confirmingCount >= 4) reliability = 'ÇOK_YÜKSEK'
      else if (confirmingCount >= 3) reliability = 'YÜKSEK'
      else if (confirmingCount >= 2) reliability = 'ORTA'

      // FILTER: Skip low-reliability buy signals
      if (reliability === 'DÜŞÜK' && ['AL FIRSATI', 'GOLDEN CROSS', 'MACD CROSSOVER', 'GÜVENLİ AL'].includes(category)) {
        continue
      }

      opportunities.push({
        id: c.stock.id,
        symbol: c.stock.symbol,
        name: c.stock.name,
        sector: c.stock.sector,
        currentPrice: c.currentPrice,
        previousClose: c.previousClose,
        changePercent: c.changePercent,
        dayHigh: c.dayHigh,
        dayLow: c.dayLow,
        volume: c.volume,
        dayRangePercent: c.dayRangePercent,
        score,
        signals,
        category,
        source: c.source,
        // Technical indicators
        rsi14: tech?.rsi14 ?? null,
        sma20: tech?.sma20 ?? null,
        sma50: tech?.sma50 ?? null,
        maSignal: tech?.maSignal ?? null,
        rsiSignal: tech?.rsiSignal ?? null,
        volumeSpike: tech?.volumeSpike ?? false,
        // Enhanced indicators
        bollinger: tech?.bollinger ? {
          percentB: tech.bollinger.percentB,
          width: tech.bollinger.width,
          squeeze: tech.bollinger.squeeze,
        } : null,
        macdCrossover: tech?.macdCrossover ? {
          crossover: tech.macdCrossover.crossover,
          histogramTrend: tech.macdCrossover.histogramTrend,
          histogram: tech.macdCrossover.histogram,
        } : null,
        confirmingIndicators: tech?.confirmingIndicators ?? 0,
        reliability,
        // Multi-timeframe
        mtf: mtf ? {
          daily: mtf.daily.signal,
          weekly: mtf.weekly.signal,
          monthly: mtf.monthly.signal,
          consensus: mtf.consensus,
          alignment: mtf.alignment,
          consensusScore: mtf.consensusScore,
        } : null,
      })
    }

    // Re-sort: prioritize reliability then score
    opportunities.sort((a, b) => {
      const reliOrder: Record<string, number> = { 'ÇOK_YÜKSEK': 4, 'YÜKSEK': 3, 'ORTA': 2, 'DÜŞÜK': 1 }
      const rDiff = (reliOrder[b.reliability] ?? 0) - (reliOrder[a.reliability] ?? 0)
      if (rDiff !== 0) return rDiff
      return b.score - a.score
    })

    // Apply category filter
    let filtered = opportunities
    if (categoryFilter && categoryFilter !== 'ALL') {
      filtered = opportunities.filter(o => o.category === categoryFilter)
    }

    const topOpportunities = filtered.slice(0, 20)
    const activeCategories = [...new Set(opportunities.map(o => o.category))]

    return NextResponse.json({
      opportunities: topOpportunities,
      categories: ALL_CATEGORIES,
      activeCategories,
      totalFound: opportunities.length,
    })
  } catch (error: any) {
    console.error('Scanner API error:', error)
    return NextResponse.json({ error: 'Tarama başarısız' }, { status: 500 })
  }
}

/**
 * Fetch enhanced technical data with 5-minute caching.
 */
async function getEnhancedTechnicalData(
  items: Array<{ yahooSymbol: string; volume: number }>
): Promise<Map<string, EnhancedTechnicalData>> {
  const results = new Map<string, EnhancedTechnicalData>()

  if (techCache && Date.now() - techCache.timestamp < TECH_CACHE_TTL) {
    for (const item of items) {
      const cached = techCache.data.get(item.yahooSymbol)
      if (cached) results.set(item.yahooSymbol, cached)
    }
    if (results.size === items.length) return results
  }

  const missing = items.filter(i => !results.has(i.yahooSymbol))
  const BATCH_SIZE = 5

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        try {
          const history = await fetchYahooHistory(item.yahooSymbol, '3M')
          if (!history || history.length < 15) return { sym: item.yahooSymbol, data: null }

          const closes = history.map(h => h.close)
          const volumes = history.map(h => Number(h.volume ?? 0))
          const tech = analyzeEnhancedTechnicals(closes, volumes, Number(item.volume ?? 0))
          return { sym: item.yahooSymbol, data: tech }
        } catch {
          return { sym: item.yahooSymbol, data: null }
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.data) {
        results.set(result.value.sym, result.value.data)
      }
    }
  }

  if (!techCache) {
    techCache = { data: results, timestamp: Date.now() }
  } else {
    for (const [sym, data] of results) {
      techCache.data.set(sym, data)
    }
    techCache.timestamp = Date.now()
  }

  return results
}

/**
 * Fetch multi-timeframe data with 10-minute caching.
 */
async function getMultiTimeframeData(
  yahooSymbols: string[]
): Promise<Map<string, MultiTimeframeData>> {
  const results = new Map<string, MultiTimeframeData>()

  if (mtfCache && Date.now() - mtfCache.timestamp < MTF_CACHE_TTL) {
    for (const sym of yahooSymbols) {
      const cached = mtfCache.data.get(sym)
      if (cached) results.set(sym, cached)
    }
    if (results.size === yahooSymbols.length) return results
  }

  const missing = yahooSymbols.filter(s => !results.has(s))
  const BATCH_SIZE = 3

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (sym) => {
        try {
          const [daily, weekly, monthly] = await Promise.allSettled([
            fetchYahooHistory(sym, '3M'),
            fetchYahooHistory(sym, '1Y'),
            fetchYahooHistory(sym, '5Y'),
          ])
          const dData = daily.status === 'fulfilled' ? daily.value : []
          const wData = weekly.status === 'fulfilled' ? weekly.value : []
          const mData = monthly.status === 'fulfilled' ? monthly.value : []

          if (dData.length < 15) return { sym, data: null }

          const mtf = generateMultiTimeframeAnalysis(
            dData.map(h => h.close), dData.map(h => Number(h.volume ?? 0)),
            wData.map(h => h.close), wData.map(h => Number(h.volume ?? 0)),
            mData.map(h => h.close), mData.map(h => Number(h.volume ?? 0)),
          )
          return { sym, data: mtf }
        } catch {
          return { sym, data: null }
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.data) {
        results.set(result.value.sym, result.value.data)
      }
    }
  }

  if (!mtfCache) {
    mtfCache = { data: results, timestamp: Date.now() }
  } else {
    for (const [sym, data] of results) {
      mtfCache.data.set(sym, data)
    }
    mtfCache.timestamp = Date.now()
  }

  return results
}