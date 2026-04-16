export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import {
  calcSMA, calcRSI, calcMACD, calcBollinger, calcROC, calcVolumeMA,
  type OHLCV,
} from '@/lib/technical-analysis'

// In-memory cache: symbol -> { data, ts }
const analysisCache = new Map<string, { result: any; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 min

interface HoldingAnalysis {
  symbol: string
  name: string
  score: number          // -100 to 100
  rating: 'GÜÇLÜ AL' | 'AL' | 'TUT' | 'SAT' | 'GÜÇLÜ SAT'
  ratingColor: string
  trend: 'yükseliş' | 'düşüş' | 'yatay'
  rsi: number | null
  macdSignal: 'pozitif' | 'negatif' | null
  smaPosition: 'üzerinde' | 'altında' | null
  volatility: number | null
  momentum: number | null
  reasons: string[]
}

function analyzeStock(data: OHLCV[]): Omit<HoldingAnalysis, 'symbol' | 'name'> {
  if (data.length < 15) {
    return {
      score: 0, rating: 'TUT', ratingColor: 'text-yellow-500',
      trend: 'yatay', rsi: null, macdSignal: null, smaPosition: null,
      volatility: null, momentum: null, reasons: ['Yetersiz veri'],
    }
  }

  const closes = data.map(d => d.close)
  const volumes = data.map(d => Number(d.volume ?? 0))
  const last = closes[closes.length - 1]
  let score = 0
  const reasons: string[] = []

  // 1. RSI(14)
  const rsi = calcRSI(closes, 14)
  const currRsi = rsi[rsi.length - 1]
  let rsiVal: number | null = currRsi
  if (currRsi !== null) {
    if (currRsi < 30) {
      score += 20
      reasons.push(`RSI ${currRsi.toFixed(0)} — aşırı satım (alım fırsatı)`)
    } else if (currRsi < 45) {
      score += 10
      reasons.push(`RSI ${currRsi.toFixed(0)} — düşük bölge`)
    } else if (currRsi <= 55) {
      score += 5
      reasons.push(`RSI ${currRsi.toFixed(0)} — nötr`)
    } else if (currRsi <= 70) {
      score -= 5
      reasons.push(`RSI ${currRsi.toFixed(0)} — yükselmiş`)
    } else {
      score -= 20
      reasons.push(`RSI ${currRsi.toFixed(0)} — aşırı alım (düzeltme riski)`)
    }
  }

  // 2. SMA(20) vs Price
  const sma20 = calcSMA(closes, 20)
  const curr20 = sma20[sma20.length - 1]
  let smaPos: 'üzerinde' | 'altında' | null = null
  if (curr20 !== null) {
    if (last > curr20) {
      score += 15
      smaPos = 'üzerinde'
      reasons.push('Fiyat SMA(20) üzerinde — yükseliş trendi')
    } else {
      score -= 15
      smaPos = 'altında'
      reasons.push('Fiyat SMA(20) altında — düşüş trendi')
    }
  }

  // 3. SMA(5) vs SMA(20) cross
  const sma5 = calcSMA(closes, 5)
  const curr5 = sma5[sma5.length - 1]
  if (curr5 !== null && curr20 !== null) {
    if (curr5 > curr20) {
      score += 10
      reasons.push('SMA(5) > SMA(20) — kısa vadeli güç')
    } else {
      score -= 10
      reasons.push('SMA(5) < SMA(20) — kısa vadeli zayıflık')
    }
  }

  // 4. MACD
  const { histogram } = calcMACD(closes, 12, 26, 9)
  const currH = histogram[histogram.length - 1]
  const prevH = histogram[histogram.length - 2]
  let macdSig: 'pozitif' | 'negatif' | null = null
  if (currH !== null) {
    if (currH > 0) {
      score += 10
      macdSig = 'pozitif'
      const improving = prevH !== null && currH > prevH
      reasons.push(`MACD pozitif${improving ? ' ve güçleniyor' : ''}`)
    } else {
      score -= 10
      macdSig = 'negatif'
      reasons.push('MACD negatif')
    }
  }

  // 5. Bollinger Band position
  const { upper, lower } = calcBollinger(closes, 20, 2)
  const currU = upper[upper.length - 1]
  const currL = lower[lower.length - 1]
  if (currU !== null && currL !== null) {
    const bandWidth = currU - currL
    const posInBand = bandWidth > 0 ? (last - currL) / bandWidth : 0.5
    if (posInBand < 0.2) {
      score += 10
      reasons.push('Bollinger alt bandına yakın (dip potansiyeli)')
    } else if (posInBand > 0.8) {
      score -= 10
      reasons.push('Bollinger üst bandına yakın (baskı riski)')
    }
  }

  // 6. Volume trend
  const volMA5 = calcVolumeMA(volumes, 5)
  const volMA20 = calcVolumeMA(volumes, 20)
  const vl5 = volMA5[volMA5.length - 1]
  const vl20 = volMA20[volMA20.length - 1]
  if (vl5 !== null && vl20 !== null && vl20 > 0) {
    if (vl5 > vl20 * 1.2) {
      score += 5
      reasons.push('Hacim artışı — alıcı ilgisi yüksek')
    } else if (vl5 < vl20 * 0.7) {
      score -= 5
      reasons.push('Hacim düşüyor')
    }
  }

  // 7. Momentum (5-day ROC)
  const roc = calcROC(closes, 5)
  const currRoc = roc[roc.length - 1]
  let momentumVal = currRoc
  if (currRoc !== null) {
    if (currRoc > 3) {
      score += 10
      reasons.push(`5 günlük ivme: +%${currRoc.toFixed(1)}`)
    } else if (currRoc > 0) {
      score += 5
    } else if (currRoc < -3) {
      score -= 10
      reasons.push(`5 günlük ivme: %${currRoc.toFixed(1)}`)
    } else if (currRoc < 0) {
      score -= 5
    }
  }

  // 8. Volatility
  const last20 = closes.slice(-20)
  const avgP = last20.reduce((a: number, b: number) => a + b, 0) / last20.length
  const vol = Math.sqrt(last20.reduce((s: number, p: number) => s + Math.pow(p - avgP, 2), 0) / last20.length) / avgP * 100
  if (vol > 8) {
    score -= 5
    reasons.push(`Volatilite %${vol.toFixed(1)} — yüksek`)
  } else if (vol < 3) {
    score += 5
    reasons.push(`Volatilite %${vol.toFixed(1)} — düşük (stabil)`)
  }

  // Clamp and determine rating
  score = Math.max(-100, Math.min(100, score))

  let rating: HoldingAnalysis['rating'] = 'TUT'
  let ratingColor = 'text-yellow-500'
  if (score >= 40) { rating = 'GÜÇLÜ AL'; ratingColor = 'text-emerald-500' }
  else if (score >= 15) { rating = 'AL'; ratingColor = 'text-green-500' }
  else if (score > -15) { rating = 'TUT'; ratingColor = 'text-yellow-500' }
  else if (score > -40) { rating = 'SAT'; ratingColor = 'text-orange-500' }
  else { rating = 'GÜÇLÜ SAT'; ratingColor = 'text-red-500' }

  // Determine trend
  let trend: HoldingAnalysis['trend'] = 'yatay'
  if (smaPos === 'üzerinde' && (macdSig === 'pozitif' || (currRsi !== null && currRsi > 50))) trend = 'yükseliş'
  else if (smaPos === 'altında' && (macdSig === 'negatif' || (currRsi !== null && currRsi < 50))) trend = 'düşüş'

  return {
    score, rating, ratingColor, trend, rsi: rsiVal, macdSignal: macdSig,
    smaPosition: smaPos, volatility: vol, momentum: momentumVal, reasons,
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const guestId = searchParams?.get('guestId') ?? ''

    let userId: string | null = null
    if (session?.user) userId = (session.user as any)?.id
    else if (guestId) {
      const g = await prisma.user.findUnique({ where: { id: guestId } })
      if (g?.isGuest) userId = guestId
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const holdings = await prisma.holding.findMany({
      where: { userId },
      include: { stock: true },
    })

    if (holdings.length === 0) {
      return NextResponse.json({ analyses: [], portfolioScore: 0, portfolioRating: 'TUT' })
    }

    const analyses: HoldingAnalysis[] = []

    for (const h of holdings) {
      const sym = h.stock.symbol
      const cached = analysisCache.get(sym)
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        analyses.push(cached.result)
        continue
      }

      let data: OHLCV[] = []
      try {
        const yahooSym = h.stock.yahooSymbol || `${sym}.IS`
        const history = await fetchYahooHistory(yahooSym, '3M')
        data = history.map(d => ({
          open: d.open, high: d.high, low: d.low,
          close: d.close, volume: Number(d.volume ?? 0),
          date: d.timestamp.toISOString(),
        }))
      } catch {}

      if (data.length === 0) {
        const since = new Date()
        since.setDate(since.getDate() - 90)
        const dbH = await prisma.priceHistory.findMany({
          where: { stockId: h.stock.id, timestamp: { gte: since } },
          orderBy: { timestamp: 'asc' },
        })
        data = dbH.map((d: any) => ({
          open: d.open ?? d.price, high: d.high ?? d.price,
          low: d.low ?? d.price, close: d.close ?? d.price,
          volume: Number(d.volume ?? 0), date: d.timestamp?.toISOString?.() ?? '',
        }))
      }

      const analysis = analyzeStock(data)
      const result: HoldingAnalysis = {
        symbol: sym,
        name: h.stock.name,
        ...analysis,
      }

      analysisCache.set(sym, { result, ts: Date.now() })
      analyses.push(result)
    }

    // Overall portfolio score: weighted by position size
    const totalValue = holdings.reduce((s: number, h: any) => s + h.quantity * (h.stock.currentPrice ?? 0), 0)
    let weightedScore = 0
    for (const a of analyses) {
      const h = holdings.find((h: any) => h.stock.symbol === a.symbol)
      if (h && totalValue > 0) {
        const weight = (h.quantity * (h.stock.currentPrice ?? 0)) / totalValue
        weightedScore += a.score * weight
      }
    }
    weightedScore = Math.round(weightedScore)

    let portfolioRating = 'TUT'
    if (weightedScore >= 40) portfolioRating = 'GÜÇLÜ'
    else if (weightedScore >= 15) portfolioRating = 'İYİ'
    else if (weightedScore > -15) portfolioRating = 'NÖTR'
    else if (weightedScore > -40) portfolioRating = 'ZAYIF'
    else portfolioRating = 'RİSKLİ'

    // Sort by score descending
    analyses.sort((a, b) => b.score - a.score)

    return NextResponse.json({
      analyses,
      portfolioScore: weightedScore,
      portfolioRating,
    })
  } catch (error: any) {
    console.error('Portfolio analysis error:', error)
    return NextResponse.json({ error: 'Analiz yapılamadı' }, { status: 500 })
  }
}