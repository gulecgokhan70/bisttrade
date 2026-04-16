export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchYahooHistory } from '@/lib/yahoo-finance'
import {
  calcSMA, calcEMA, calcRSI, calcMACD, calcBollinger, generateSignal,
  calcROC, calcVolumeMA, calcStochRSI,
} from '@/lib/technical-analysis'
import {
  generateMultiTimeframeAnalysis,
  analyzeEnhancedTechnicals,
  calculateBollingerBands,
  detectMACDCrossover,
  calculateSMA,
  calculateEMA,
} from '@/lib/technical-indicators'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams?.get('symbol') ?? ''
    const period = searchParams?.get('period') ?? '3M'
    const indicator = searchParams?.get('indicator') ?? 'ALL'
    const mode = searchParams?.get('mode') ?? ''

    if (!symbol) {
      return NextResponse.json({ error: 'Sembol gerekli' }, { status: 400 })
    }

    const stock = await prisma.stock.findUnique({ where: { symbol } })
    if (!stock) {
      return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 })
    }

    // Technical panel mode - returns simplified data for the trade page
    if (mode === 'technical') {
      return await handleTechnicalMode(stock)
    }

    // Yahoo Finance is the single source for all historical data
    let history: any[] = []
    if (stock.yahooSymbol) {
      history = await fetchYahooHistory(stock.yahooSymbol, period)
    }

    // Fallback to DB if Yahoo fails
    if (history.length === 0) {
      let daysBack = 90
      switch (period) {
        case '1M': daysBack = 30; break
        case '3M': daysBack = 90; break
        case '1Y': daysBack = 365; break
      }
      const since = new Date()
      since.setDate(since.getDate() - daysBack)
      const dbHistory = await prisma.priceHistory.findMany({
        where: { stockId: stock.id, timestamp: { gte: since } },
        orderBy: { timestamp: 'asc' },
      })
      history = dbHistory.map((h: any) => ({
        timestamp: h.timestamp,
        open: h.open ?? h.price,
        high: h.high ?? h.price,
        low: h.low ?? h.price,
        close: h.close ?? h.price,
        volume: Number(h.volume ?? 0),
      }))
    }

    if (history.length === 0) {
      return NextResponse.json({ error: 'Yeterli veri yok' }, { status: 404 })
    }

    const closes = history.map((h: any) => h.close)
    const result: any = {
      stock,
      history: history.map((h: any) => ({
        ...h,
        volume: Number(h.volume ?? 0),
        timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : h.timestamp,
      })),
      indicators: {},
    }

    // Calculate indicators (daily-optimized)
    const volumes = history.map((h: any) => Number(h.volume ?? 0))
    if (indicator === 'ALL' || indicator === 'SMA') {
      result.indicators.sma7 = calcSMA(closes, 5)
      result.indicators.sma21 = calcSMA(closes, 10)
      result.indicators.sma50 = calcSMA(closes, 20)
    }
    if (indicator === 'ALL' || indicator === 'EMA') {
      result.indicators.ema12 = calcEMA(closes, 9)
      result.indicators.ema26 = calcEMA(closes, 21)
    }
    if (indicator === 'ALL' || indicator === 'RSI') {
      result.indicators.rsi = calcRSI(closes, 14)
      result.indicators.stochRsi = calcStochRSI(closes, 14, 14)
    }
    if (indicator === 'ALL' || indicator === 'MACD') {
      result.indicators.macd = calcMACD(closes, 5, 13, 6)
    }
    if (indicator === 'ALL' || indicator === 'BOLLINGER') {
      result.indicators.bollinger = calcBollinger(closes, 15, 1.8)
    }
    result.indicators.roc = calcROC(closes, 3)
    result.indicators.volumeMA = calcVolumeMA(volumes, 10)

    // Generate daily signals for all strategies
    const ohlcv = history.map((h: any) => ({ open: h.open, high: h.high, low: h.low, close: h.close, volume: Number(h.volume ?? 0) }))
    result.signals = {
      SMA_CROSSOVER: generateSignal(ohlcv, 'SMA_CROSSOVER'),
      RSI_STRATEGY: generateSignal(ohlcv, 'RSI_STRATEGY'),
      RSI_LONG: generateSignal(ohlcv, 'RSI_LONG'),
      MACD_STRATEGY: generateSignal(ohlcv, 'MACD_STRATEGY'),
      BOLLINGER_STRATEGY: generateSignal(ohlcv, 'BOLLINGER_STRATEGY'),
      COMBINED: generateSignal(ohlcv, 'COMBINED'),
    }

    // ========== Multi-Timeframe Analysis (Daily + Weekly + Monthly) ==========
    if (stock.yahooSymbol) {
      try {
        // Fetch daily (3M), weekly (1Y), monthly (5Y) data in parallel
        const [dailyHistory, weeklyHistory, monthlyHistory] = await Promise.allSettled([
          period === '3M' || period === '1M' ? Promise.resolve(history) : fetchYahooHistory(stock.yahooSymbol, '3M'),
          fetchYahooHistory(stock.yahooSymbol, '1Y'),
          fetchYahooHistory(stock.yahooSymbol, '5Y'),
        ])

        const dailyData = dailyHistory.status === 'fulfilled' ? dailyHistory.value : history
        const weeklyData = weeklyHistory.status === 'fulfilled' ? weeklyHistory.value : []
        const monthlyData = monthlyHistory.status === 'fulfilled' ? monthlyHistory.value : []

        const dCloses = (dailyData as any[]).map((h: any) => h.close)
        const dVols = (dailyData as any[]).map((h: any) => Number(h.volume ?? 0))
        const wCloses = (weeklyData as any[]).map((h: any) => h.close)
        const wVols = (weeklyData as any[]).map((h: any) => Number(h.volume ?? 0))
        const mCloses = (monthlyData as any[]).map((h: any) => h.close)
        const mVols = (monthlyData as any[]).map((h: any) => Number(h.volume ?? 0))

        result.multiTimeframe = generateMultiTimeframeAnalysis(
          dCloses, dVols, wCloses, wVols, mCloses, mVols
        )
      } catch (err) {
        console.error('Multi-timeframe analysis error:', err)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Analysis API error:', error)
    return NextResponse.json({ error: 'Analiz alınamadı' }, { status: 500 })
  }
}

// ========== Technical Panel Mode ==========
async function handleTechnicalMode(stock: any) {
  try {
    let history: any[] = []
    if (stock.yahooSymbol) {
      history = await fetchYahooHistory(stock.yahooSymbol, '3M')
    }
    
    if (history.length < 20) {
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const dbHistory = await prisma.priceHistory.findMany({
        where: { stockId: stock.id, timestamp: { gte: since } },
        orderBy: { timestamp: 'asc' },
      })
      if (dbHistory.length > history.length) {
        history = dbHistory.map((h: any) => ({
          open: h.open ?? h.price, high: h.high ?? h.price,
          low: h.low ?? h.price, close: h.close ?? h.price,
          volume: Number(h.volume ?? 0),
        }))
      }
    }

    if (history.length < 5) {
      return NextResponse.json({ error: 'Yetersiz veri' }, { status: 404 })
    }

    const closes = history.map((h: any) => h.close)
    const highs = history.map((h: any) => h.high)
    const lows = history.map((h: any) => h.low)
    const volumes = history.map((h: any) => Number(h.volume ?? 0))
    const currentPrice = closes[closes.length - 1]
    const currentVolume = volumes[volumes.length - 1] ?? 0

    const enhanced = analyzeEnhancedTechnicals(closes, volumes, currentVolume)
    const ema12 = calculateEMA(closes, 12)
    const ema26 = calculateEMA(closes, 26)
    const bollinger = calculateBollingerBands(closes, 20, 2)
    const macdCrossover = detectMACDCrossover(closes)

    // Support & Resistance
    const support: number[] = []
    const resistance: number[] = []
    
    if (history.length >= 20) {
      const recentHighs = highs.slice(-20)
      const recentLows = lows.slice(-20)
      
      for (let i = 2; i < recentHighs.length - 2; i++) {
        if (recentHighs[i] > recentHighs[i-1] && recentHighs[i] > recentHighs[i-2] &&
            recentHighs[i] > recentHighs[i+1] && recentHighs[i] > recentHighs[i+2]) {
          if (recentHighs[i] > currentPrice) resistance.push(recentHighs[i])
          else support.push(recentHighs[i])
        }
        if (recentLows[i] < recentLows[i-1] && recentLows[i] < recentLows[i-2] &&
            recentLows[i] < recentLows[i+1] && recentLows[i] < recentLows[i+2]) {
          if (recentLows[i] < currentPrice) support.push(recentLows[i])
          else resistance.push(recentLows[i])
        }
      }
      
      if (enhanced.sma20 !== null) {
        if (enhanced.sma20 < currentPrice) support.push(enhanced.sma20)
        else resistance.push(enhanced.sma20)
      }
      if (enhanced.sma50 !== null) {
        if (enhanced.sma50 < currentPrice) support.push(enhanced.sma50)
        else resistance.push(enhanced.sma50)
      }
      if (bollinger) {
        if (bollinger.lower < currentPrice) support.push(bollinger.lower)
        if (bollinger.upper > currentPrice) resistance.push(bollinger.upper)
      }
    }

    const uniqueSupport = [...new Set(support.map(s => parseFloat(s.toFixed(2))))]
      .sort((a, b) => b - a).slice(0, 3)
    const uniqueResistance = [...new Set(resistance.map(r => parseFloat(r.toFixed(2))))]
      .sort((a, b) => a - b).slice(0, 3)

    let bullCount = 0
    let bearCount = 0
    const totalIndicators = 5

    if (enhanced.rsi14 !== null) {
      if (enhanced.rsi14 <= 35) bullCount++
      else if (enhanced.rsi14 >= 65) bearCount++
    }
    if (enhanced.maSignal === 'GOLDEN_CROSS' || enhanced.maSignal === 'ABOVE_MA20') bullCount++
    else if (enhanced.maSignal === 'DEATH_CROSS' || enhanced.maSignal === 'BELOW_MA20') bearCount++
    if (macdCrossover) {
      if (macdCrossover.histogram > 0) bullCount++
      else bearCount++
    }
    if (bollinger) {
      if (bollinger.percentB <= 0.2) bullCount++
      else if (bollinger.percentB >= 0.8) bearCount++
    }
    if (enhanced.volumeSpike) {
      if (currentPrice > (closes.length > 1 ? closes[closes.length - 2] : currentPrice)) bullCount++
      else bearCount++
    }

    const overallSignal = bullCount >= 3 ? 'AL' : bearCount >= 3 ? 'SAT' : 'BEKLE'
    const signalStrength = Math.max(bullCount, bearCount)

    let mtf = null
    if (stock.yahooSymbol) {
      try {
        const [weeklyHistory, monthlyHistory] = await Promise.allSettled([
          fetchYahooHistory(stock.yahooSymbol, '1Y'),
          fetchYahooHistory(stock.yahooSymbol, '5Y'),
        ])
        const wData = weeklyHistory.status === 'fulfilled' ? weeklyHistory.value : []
        const mData = monthlyHistory.status === 'fulfilled' ? monthlyHistory.value : []
        
        if ((wData as any[]).length > 0 || (mData as any[]).length > 0) {
          const mtfResult = generateMultiTimeframeAnalysis(
            closes, volumes,
            (wData as any[]).map((h: any) => h.close), (wData as any[]).map((h: any) => Number(h.volume ?? 0)),
            (mData as any[]).map((h: any) => h.close), (mData as any[]).map((h: any) => Number(h.volume ?? 0))
          )
          mtf = {
            daily: { signal: mtfResult.daily.signal, confidence: mtfResult.daily.confidence },
            weekly: { signal: mtfResult.weekly.signal, confidence: mtfResult.weekly.confidence },
            monthly: { signal: mtfResult.monthly.signal, confidence: mtfResult.monthly.confidence },
            consensus: mtfResult.consensus,
            consensusScore: mtfResult.consensusScore,
            alignment: mtfResult.alignment,
          }
        }
      } catch (err) {
        console.error('MTF error:', err)
      }
    }

    return NextResponse.json({
      rsi14: enhanced.rsi14,
      sma20: enhanced.sma20,
      sma50: enhanced.sma50,
      ema12, ema26,
      macd: macdCrossover ? { macd: macdCrossover.macd, signal: macdCrossover.signal, histogram: macdCrossover.histogram } : null,
      bollinger,
      macdCrossover: macdCrossover ? { crossover: macdCrossover.crossover, histogramTrend: macdCrossover.histogramTrend } : null,
      support: uniqueSupport,
      resistance: uniqueResistance,
      overallSignal,
      signalStrength,
      confirmingIndicators: Math.max(bullCount, bearCount),
      totalIndicators,
      mtf,
    })
  } catch (error: any) {
    console.error('Technical mode error:', error)
    return NextResponse.json({ error: 'Teknik analiz alinamadi' }, { status: 500 })
  }
}