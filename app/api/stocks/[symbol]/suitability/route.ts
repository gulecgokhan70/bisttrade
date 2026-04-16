export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import {
  calcSMA, calcEMA, calcRSI, calcMACD, calcBollinger, calcROC, calcVolumeMA,
  type OHLCV,
} from '@/lib/technical-analysis'

interface SuitabilityResult {
  rating: 'UYGUN' | 'RISKLI' | 'NOTR'
  score: number // -100 to 100
  reasons: string[]
}

function analyzeDaily(data: OHLCV[]): SuitabilityResult {
  if (data.length < 5) return { rating: 'NOTR', score: 0, reasons: ['Yetersiz veri (en az 5 gün gerekli)'] }

  const closes = data.map(d => d.close)
  const highs = data.map(d => d.high)
  const lows = data.map(d => d.low)
  const volumes = data.map(d => Number(d.volume ?? 0))
  const last = closes[closes.length - 1]

  let score = 0
  const reasons: string[] = []

  // 1. RSI(5) — very short term momentum
  const rsi = calcRSI(closes, 5)
  const currRsi = rsi[rsi.length - 1]
  if (currRsi !== null) {
    if (currRsi >= 40 && currRsi <= 60) {
      score += 15
      reasons.push(`RSI(5): ${currRsi.toFixed(0)} — nötr bölge (giriş uygun)`)
    } else if (currRsi < 30) {
      score += 10
      reasons.push(`RSI(5): ${currRsi.toFixed(0)} — aşırı satım (gün içi toparlanma beklenir)`)
    } else if (currRsi > 70) {
      score -= 15
      reasons.push(`RSI(5): ${currRsi.toFixed(0)} — aşırı alım (gün içi düzeltme riski)`)
    } else if (currRsi > 60) {
      score -= 5
      reasons.push(`RSI(5): ${currRsi.toFixed(0)} — yükselmiş`)
    } else {
      score += 5
      reasons.push(`RSI(5): ${currRsi.toFixed(0)} — düşük bölge`)
    }
  }

  // 2. Previous day candle analysis
  const prevClose = closes[closes.length - 2]
  const prevHigh = highs[highs.length - 2]
  const prevLow = lows[lows.length - 2]
  if (prevClose && prevHigh && prevLow && prevHigh !== prevLow) {
    const bodyPos = (prevClose - prevLow) / (prevHigh - prevLow) // 0-1, 1 = closed at high
    if (bodyPos > 0.7) {
      score += 10
      reasons.push('Önceki gün güçlü kapanış (üst bölgede)')
    } else if (bodyPos < 0.3) {
      score -= 10
      reasons.push('Önceki gün zayıf kapanış (alt bölgede)')
    }
  }

  // 3. SMA(3) vs SMA(5) — ultra short trend
  const sma3 = calcSMA(closes, 3)
  const sma5 = calcSMA(closes, 5)
  const curr3 = sma3[sma3.length - 1]
  const curr5 = sma5[sma5.length - 1]
  if (curr3 !== null && curr5 !== null) {
    if (curr3 > curr5) {
      score += 15
      reasons.push('SMA(3) > SMA(5) — çok kısa vadeli yükseliş')
    } else {
      score -= 10
      reasons.push('SMA(3) < SMA(5) — çok kısa vadeli düşüş')
    }
  }

  // 4. 1-day price change
  if (prevClose && prevClose > 0) {
    const dayReturn = ((last - prevClose) / prevClose) * 100
    if (dayReturn > 0.5) {
      score += 10
      reasons.push(`Günlük değişim: +%${dayReturn.toFixed(1)} — pozitif momentum`)
    } else if (dayReturn < -1) {
      score -= 10
      reasons.push(`Günlük değişim: %${dayReturn.toFixed(1)} — negatif`)
    } else {
      score += 5
      reasons.push(`Günlük değişim: %${dayReturn.toFixed(1)} — nötr`)
    }
  }

  // 5. Volume spike check (today vs 5-day avg)
  const volMA = calcVolumeMA(volumes, 5)
  const lastVol = volumes[volumes.length - 1]
  const avgVol = volMA[volMA.length - 1]
  if (avgVol !== null && avgVol > 0) {
    const volRatio = lastVol / avgVol
    if (volRatio > 1.5) {
      score += 10
      reasons.push(`Hacim ortalamanın ${volRatio.toFixed(1)}x üstünde — güçlü ilgi`)
    } else if (volRatio < 0.5) {
      score -= 5
      reasons.push('Hacim düşük — düşük likidite riski')
    }
  }

  // 6. Intraday volatility (2-day range)
  const last2Highs = highs.slice(-2)
  const last2Lows = lows.slice(-2)
  const rangeHigh = Math.max(...last2Highs)
  const rangeLow = Math.min(...last2Lows)
  if (rangeLow > 0) {
    const intraVol = ((rangeHigh - rangeLow) / rangeLow) * 100
    if (intraVol < 2) {
      score += 5
      reasons.push(`Gün içi dalgalanma: %${intraVol.toFixed(1)} — düşük`)
    } else if (intraVol > 5) {
      score -= 10
      reasons.push(`Gün içi dalgalanma: %${intraVol.toFixed(1)} — yüksek risk`)
    }
  }

  score = Math.max(-100, Math.min(100, score))
  const rating: SuitabilityResult['rating'] = score >= 15 ? 'UYGUN' : score <= -10 ? 'RISKLI' : 'NOTR'
  return { rating, score, reasons }
}

function analyzeWeekly(data: OHLCV[]): SuitabilityResult {
  if (data.length < 15) return { rating: 'NOTR', score: 0, reasons: ['Yetersiz veri (en az 15 gün gerekli)'] }

  const closes = data.map(d => d.close)
  const volumes = data.map(d => Number(d.volume ?? 0))
  const last = closes[closes.length - 1]

  let score = 0
  const reasons: string[] = []

  // 1. RSI(9) — short term momentum
  const rsi = calcRSI(closes, 9)
  const currRsi = rsi[rsi.length - 1]
  if (currRsi !== null) {
    if (currRsi >= 35 && currRsi <= 65) {
      score += 15
      reasons.push(`RSI(9): ${currRsi.toFixed(0)} — nötr bölgede (iyi)`)
    } else if (currRsi < 35) {
      score += 5
      reasons.push(`RSI(9): ${currRsi.toFixed(0)} — aşırı satım (dip alım fırsatı)`)
    } else {
      score -= 10
      reasons.push(`RSI(9): ${currRsi.toFixed(0)} — aşırı alım (düzeltme riski)`)
    }
  }

  // 2. Short-term volatility (5-day)
  const last5 = closes.slice(-5)
  const avgPrice5 = last5.reduce((a, b) => a + b, 0) / last5.length
  const volatility5 = Math.sqrt(last5.reduce((s, p) => s + Math.pow(p - avgPrice5, 2), 0) / last5.length) / avgPrice5 * 100
  if (volatility5 < 2) {
    score += 10
    reasons.push(`Haftalık volatilite: %${volatility5.toFixed(1)} — düşük (stabil)`)
  } else if (volatility5 < 4) {
    score += 5
    reasons.push(`Haftalık volatilite: %${volatility5.toFixed(1)} — orta`)
  } else {
    score -= 10
    reasons.push(`Haftalık volatilite: %${volatility5.toFixed(1)} — yüksek (riskli)`)
  }

  // 3. SMA(5) vs SMA(10) trend
  const sma5 = calcSMA(closes, 5)
  const sma10 = calcSMA(closes, 10)
  const curr5 = sma5[sma5.length - 1]
  const curr10 = sma10[sma10.length - 1]
  if (curr5 !== null && curr10 !== null) {
    if (curr5 > curr10) {
      score += 15
      reasons.push('SMA(5) > SMA(10) — kısa vadeli yükseliş trendi')
    } else {
      score -= 10
      reasons.push('SMA(5) < SMA(10) — kısa vadeli düşüş trendi')
    }
  }

  // 4. Volume trend (increasing volume = good for weekly trade)
  const volMA5 = calcVolumeMA(volumes, 5)
  const volMA10 = calcVolumeMA(volumes, 10)
  const lastVM5 = volMA5[volMA5.length - 1]
  const lastVM10 = volMA10[volMA10.length - 1]
  if (lastVM5 !== null && lastVM10 !== null && lastVM10 > 0) {
    if (lastVM5 > lastVM10 * 1.1) {
      score += 10
      reasons.push('Hacim artışı mevcut — alıcı ilgisi yüksek')
    } else if (lastVM5 < lastVM10 * 0.8) {
      score -= 5
      reasons.push('Hacim düşüyor — ilgi azalıyor')
    }
  }

  // 5. 3-day momentum
  const roc = calcROC(closes, 3)
  const currRoc = roc[roc.length - 1]
  if (currRoc !== null) {
    if (currRoc > 1) {
      score += 10
      reasons.push(`3 günlük ivme: +%${currRoc.toFixed(1)}`)
    } else if (currRoc < -2) {
      score -= 10
      reasons.push(`3 günlük ivme: %${currRoc.toFixed(1)} — negatif`)
    }
  }

  // Clamp score
  score = Math.max(-100, Math.min(100, score))
  const rating: SuitabilityResult['rating'] = score >= 15 ? 'UYGUN' : score <= -10 ? 'RISKLI' : 'NOTR'
  return { rating, score, reasons }
}

function analyzeMonthly(data: OHLCV[]): SuitabilityResult {
  if (data.length < 30) return { rating: 'NOTR', score: 0, reasons: ['Yetersiz veri (en az 30 gün gerekli)'] }

  const closes = data.map(d => d.close)
  const volumes = data.map(d => Number(d.volume ?? 0))
  const last = closes[closes.length - 1]

  let score = 0
  const reasons: string[] = []

  // 1. RSI(14) — medium term
  const rsi = calcRSI(closes, 14)
  const currRsi = rsi[rsi.length - 1]
  if (currRsi !== null) {
    if (currRsi >= 40 && currRsi <= 60) {
      score += 15
      reasons.push(`RSI(14): ${currRsi.toFixed(0)} — nötr bölge (güvenli)`)
    } else if (currRsi < 30) {
      score += 10
      reasons.push(`RSI(14): ${currRsi.toFixed(0)} — aşırı satım (toparlanma beklenebilir)`)
    } else if (currRsi > 70) {
      score -= 15
      reasons.push(`RSI(14): ${currRsi.toFixed(0)} — aşırı alım (düzeltme riski yüksek)`)
    } else if (currRsi > 60) {
      score -= 5
      reasons.push(`RSI(14): ${currRsi.toFixed(0)} — yükselmiş`)
    } else {
      score += 5
      reasons.push(`RSI(14): ${currRsi.toFixed(0)} — düşük bölge`)
    }
  }

  // 2. SMA(20) trend — medium term
  const sma20 = calcSMA(closes, 20)
  const curr20 = sma20[sma20.length - 1]
  if (curr20 !== null) {
    if (last > curr20) {
      score += 15
      reasons.push('Fiyat SMA(20) üzerinde — orta vadeli yükseliş')
    } else {
      score -= 10
      reasons.push('Fiyat SMA(20) altında — orta vadeli düşüş')
    }
  }

  // 3. MACD trend
  const { histogram } = calcMACD(closes, 12, 26, 9)
  const currH = histogram[histogram.length - 1]
  const prevH = histogram[histogram.length - 2]
  if (currH !== null) {
    if (currH > 0) {
      score += 10
      const improving = prevH !== null && currH > prevH
      reasons.push(`MACD histogram pozitif${improving ? ' ve artıyor' : ''}`)
    } else {
      score -= 10
      const worsening = prevH !== null && currH < prevH
      reasons.push(`MACD histogram negatif${worsening ? ' ve düşüyor' : ''}`)
    }
  }

  // 4. Bollinger Band width — measure volatility
  const { upper, lower, middle } = calcBollinger(closes, 20, 2)
  const currU = upper[upper.length - 1]
  const currL = lower[lower.length - 1]
  const currM = middle[middle.length - 1]
  if (currU !== null && currL !== null && currM !== null && currM > 0) {
    const bandWidth = ((currU - currL) / currM) * 100
    if (bandWidth < 5) {
      score += 10
      reasons.push(`Bollinger genişliği: %${bandWidth.toFixed(1)} — sıkışma (kırılım potansiyeli)`)
    } else if (bandWidth > 15) {
      score -= 10
      reasons.push(`Bollinger genişliği: %${bandWidth.toFixed(1)} — yüksek dalgalanma`)
    } else {
      score += 5
      reasons.push(`Bollinger genişliği: %${bandWidth.toFixed(1)} — normal`)
    }
  }

  // 5. Monthly volatility (20-day)
  const last20 = closes.slice(-20)
  const avgPrice20 = last20.reduce((a, b) => a + b, 0) / last20.length
  const vol20 = Math.sqrt(last20.reduce((s, p) => s + Math.pow(p - avgPrice20, 2), 0) / last20.length) / avgPrice20 * 100
  if (vol20 < 3) {
    score += 10
    reasons.push(`Aylık volatilite: %${vol20.toFixed(1)} — düşük`)
  } else if (vol20 < 6) {
    score += 5
    reasons.push(`Aylık volatilite: %${vol20.toFixed(1)} — orta`)
  } else {
    score -= 10
    reasons.push(`Aylık volatilite: %${vol20.toFixed(1)} — yüksek`)
  }

  // 6. 20-day price change
  const price20ago = closes[closes.length - 21] ?? closes[0]
  const monthReturn = ((last - price20ago) / price20ago) * 100
  if (monthReturn > 3) {
    score += 10
    reasons.push(`20 gün getiri: +%${monthReturn.toFixed(1)}`)
  } else if (monthReturn < -5) {
    score -= 10
    reasons.push(`20 gün getiri: %${monthReturn.toFixed(1)} — kayıp`)
  }

  score = Math.max(-100, Math.min(100, score))
  const rating: SuitabilityResult['rating'] = score >= 15 ? 'UYGUN' : score <= -10 ? 'RISKLI' : 'NOTR'
  return { rating, score, reasons }
}

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params?.symbol ?? ''
    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })

    // Fetch 3-month history for analysis
    let data: OHLCV[] = []
    if (stock.yahooSymbol) {
      const history = await fetchYahooHistory(stock.yahooSymbol, '3M')
      data = history.map(h => ({
        open: h.open,
        high: h.high,
        low: h.low,
        close: h.close,
        volume: Number(h.volume ?? 0),
        date: h.timestamp.toISOString(),
      }))
    }

    if (data.length === 0) {
      // Fallback: try DB
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const dbHistory = await prisma.priceHistory.findMany({
        where: { stockId: stock.id, timestamp: { gte: since } },
        orderBy: { timestamp: 'asc' },
      })
      data = dbHistory.map((h: any) => ({
        open: h.open ?? h.price,
        high: h.high ?? h.price,
        low: h.low ?? h.price,
        close: h.close ?? h.price,
        volume: Number(h.volume ?? 0),
        date: h.timestamp?.toISOString?.() ?? '',
      }))
    }

    const daily = analyzeDaily(data)
    const weekly = analyzeWeekly(data)
    const monthly = analyzeMonthly(data)

    return NextResponse.json({
      symbol: stock.symbol,
      name: stock.name,
      daily,
      weekly,
      monthly,
      dataPoints: data.length,
    })
  } catch (error: any) {
    console.error('Suitability API error:', error)
    return NextResponse.json({ error: 'Analiz yapılamadı' }, { status: 500 })
  }
}
