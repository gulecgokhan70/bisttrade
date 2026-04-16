// Technical indicator calculations for scanner & analysis
// Supports daily, weekly, and monthly timeframes

export type TimeframeSignal = 'AL' | 'SAT' | 'BEKLE'

export interface TimeframeAnalysis {
  signal: TimeframeSignal
  confidence: number
  reasons: string[]
  rsi: number | null
  maSignal: string | null
  macdSignal: string | null
  trend: 'UP' | 'DOWN' | 'NEUTRAL'
}

export interface MultiTimeframeData {
  daily: TimeframeAnalysis
  weekly: TimeframeAnalysis
  monthly: TimeframeAnalysis
  consensus: TimeframeSignal
  consensusScore: number // -100 to +100
  alignment: 'UYUMLU' | 'KARMA' | 'ZİT' // all agree, mixed, opposing
}

export interface TechnicalData {
  rsi14: number | null
  sma20: number | null
  sma50: number | null
  maSignal: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'ABOVE_MA20' | 'BELOW_MA20' | null
  rsiSignal: 'AŞIRI_ALIM' | 'AŞIRI_SATIM' | 'NÖTR' | null
  volumeSpike: boolean
  avgVolume20: number | null
  // Multi-timeframe
  multiTimeframe?: MultiTimeframeData
}

// ========== Basic Calculations ==========

export function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null

  // Wilder's Smoothed RSI - uses all available data, not just last N candles
  // Step 1: Calculate initial average gain/loss from first `period` changes
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  // Step 2: Wilder smoothing for remaining data points
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return parseFloat((100 - (100 / (1 + rs))).toFixed(1))
}

export function calculateSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(2))
}

export function calculateEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null
  const multiplier = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema
  }
  return parseFloat(ema.toFixed(2))
}

export function calculateMACD(closes: number[], fast = 12, slow = 26, signal = 9): {
  macd: number | null; signal: number | null; histogram: number | null
} {
  const fastEma = calculateEMA(closes, fast)
  const slowEma = calculateEMA(closes, slow)
  if (fastEma === null || slowEma === null) return { macd: null, signal: null, histogram: null }
  const macdVal = parseFloat((fastEma - slowEma).toFixed(4))
  
  // Calculate signal line from MACD values series
  if (closes.length < slow + signal) return { macd: macdVal, signal: null, histogram: null }
  const macdSeries: number[] = []
  const mult = 2 / (fast + 1)
  const multS = 2 / (slow + 1)
  let emaF = closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast
  let emaS = closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow
  for (let i = Math.max(fast, slow); i < closes.length; i++) {
    emaF = (closes[i] - emaF) * mult + emaF
    emaS = (closes[i] - emaS) * multS + emaS
    macdSeries.push(emaF - emaS)
  }
  if (macdSeries.length < signal) return { macd: macdVal, signal: null, histogram: null }
  const sigMult = 2 / (signal + 1)
  let sigEma = macdSeries.slice(0, signal).reduce((a, b) => a + b, 0) / signal
  for (let i = signal; i < macdSeries.length; i++) {
    sigEma = (macdSeries[i] - sigEma) * sigMult + sigEma
  }
  const signalVal = parseFloat(sigEma.toFixed(4))
  return { macd: macdVal, signal: signalVal, histogram: parseFloat((macdVal - signalVal).toFixed(4)) }
}

export function calculateAvgVolume(volumes: number[], period: number): number | null {
  if (volumes.length < period) return null
  const slice = volumes.slice(-period)
  return Math.round(slice.reduce((a, b) => a + b, 0) / period)
}

// ========== Timeframe Signal Generation ==========

/**
 * Generate trading signal for a specific timeframe from OHLCV data.
 * Uses RSI + SMA crossover + MACD + price-MA relationship
 */
export function generateTimeframeSignal(
  closes: number[],
  volumes: number[],
  timeframe: 'daily' | 'weekly' | 'monthly'
): TimeframeAnalysis {
  const nullResult: TimeframeAnalysis = {
    signal: 'BEKLE', confidence: 0, reasons: ['Yetersiz veri'],
    rsi: null, maSignal: null, macdSignal: null, trend: 'NEUTRAL'
  }
  
  // Minimum data requirements
  const minBars = timeframe === 'daily' ? 20 : timeframe === 'weekly' ? 12 : 6
  if (closes.length < minBars) return nullResult

  const lastPrice = closes[closes.length - 1]
  const lastVol = volumes.length > 0 ? volumes[volumes.length - 1] : 0
  
  // Parameters per timeframe
  const params = timeframe === 'daily'
    ? { rsiPeriod: 14, smaFast: 5, smaSlow: 20, smaTrend: 50, macdF: 5, macdS: 13, macdSig: 6, rsiOB: 65, rsiOS: 35 }
    : timeframe === 'weekly'
    ? { rsiPeriod: 14, smaFast: 10, smaSlow: 20, smaTrend: 40, macdF: 12, macdS: 26, macdSig: 9, rsiOB: 70, rsiOS: 30 }
    : { rsiPeriod: 14, smaFast: 6, smaSlow: 12, smaTrend: 24, macdF: 12, macdS: 26, macdSig: 9, rsiOB: 70, rsiOS: 30 }

  let score = 0
  const reasons: string[] = []

  // --- RSI ---
  const rsi = calculateRSI(closes, params.rsiPeriod)
  let rsiLabel: string | null = null
  if (rsi !== null) {
    if (rsi <= params.rsiOS) {
      score += 2
      rsiLabel = `RSI ${rsi} Aşırı Satım`
      reasons.push(rsiLabel)
    } else if (rsi >= params.rsiOB) {
      score -= 2
      rsiLabel = `RSI ${rsi} Aşırı Alım`
      reasons.push(rsiLabel)
    } else if (rsi < 45) {
      score += 0.5
      reasons.push(`RSI ${rsi}`)
    } else if (rsi > 55) {
      score -= 0.5
      reasons.push(`RSI ${rsi}`)
    } else {
      reasons.push(`RSI ${rsi} Nötr`)
    }
  }

  // --- SMA Crossover ---
  const smaFast = calculateSMA(closes, params.smaFast)
  const smaSlow = calculateSMA(closes, params.smaSlow)
  const smaTrend = calculateSMA(closes, params.smaTrend)
  let maSignalStr: string | null = null
  
  if (smaFast !== null && smaSlow !== null) {
    if (smaFast > smaSlow) {
      score += 1.5
      maSignalStr = `SMA(${params.smaFast})>SMA(${params.smaSlow})`
      reasons.push(maSignalStr)
    } else {
      score -= 1.5
      maSignalStr = `SMA(${params.smaFast})<SMA(${params.smaSlow})`
      reasons.push(maSignalStr)
    }
  }

  // --- Trend (price vs long SMA) ---
  let trend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL'
  if (smaTrend !== null) {
    if (lastPrice > smaTrend * 1.01) {
      score += 1
      trend = 'UP'
      reasons.push('Trend ↑')
    } else if (lastPrice < smaTrend * 0.99) {
      score -= 1
      trend = 'DOWN'
      reasons.push('Trend ↓')
    } else {
      reasons.push('Trend ↔')
    }
  }

  // --- MACD ---
  const macd = calculateMACD(closes, params.macdF, params.macdS, params.macdSig)
  let macdSignalStr: string | null = null
  if (macd.histogram !== null) {
    if (macd.histogram > 0) {
      score += 1
      macdSignalStr = 'MACD+'
      reasons.push('MACD Pozitif')
    } else {
      score -= 1
      macdSignalStr = 'MACD-'
      reasons.push('MACD Negatif')
    }
  }

  // --- Volume confirmation ---
  const avgVol = calculateAvgVolume(volumes, 20)
  if (avgVol && avgVol > 0 && lastVol > avgVol * 1.5) {
    score += (score > 0 ? 0.5 : -0.5)
    reasons.push('Hacim ↑')
  }

  // --- Determine signal ---
  const absScore = Math.abs(score)
  const confidence = Math.min(Math.round(absScore * 12 + 15), 92)
  let signal: TimeframeSignal = 'BEKLE'
  if (score >= 2) signal = 'AL'
  else if (score <= -2) signal = 'SAT'

  return { signal, confidence, reasons, rsi, maSignal: maSignalStr, macdSignal: macdSignalStr, trend }
}

/**
 * Generate multi-timeframe consensus from daily, weekly, monthly OHLCV data
 */
export function generateMultiTimeframeAnalysis(
  dailyCloses: number[], dailyVolumes: number[],
  weeklyCloses: number[], weeklyVolumes: number[],
  monthlyCloses: number[], monthlyVolumes: number[]
): MultiTimeframeData {
  const daily = generateTimeframeSignal(dailyCloses, dailyVolumes, 'daily')
  const weekly = generateTimeframeSignal(weeklyCloses, weeklyVolumes, 'weekly')
  const monthly = generateTimeframeSignal(monthlyCloses, monthlyVolumes, 'monthly')

  // Calculate consensus score (-100 to +100)
  const signalToNum = (s: TimeframeSignal) => s === 'AL' ? 1 : s === 'SAT' ? -1 : 0
  const dailyW = 0.25   // daily weight
  const weeklyW = 0.35   // weekly weight
  const monthlyW = 0.40  // monthly weight (most important for direction)
  
  const weightedScore = (
    signalToNum(daily.signal) * dailyW * daily.confidence +
    signalToNum(weekly.signal) * weeklyW * weekly.confidence +
    signalToNum(monthly.signal) * monthlyW * monthly.confidence
  )
  const maxPossible = dailyW * 92 + weeklyW * 92 + monthlyW * 92
  const consensusScore = Math.round((weightedScore / maxPossible) * 100)

  // Determine consensus
  let consensus: TimeframeSignal = 'BEKLE'
  if (consensusScore >= 20) consensus = 'AL'
  else if (consensusScore <= -20) consensus = 'SAT'

  // Check alignment
  const signals = [daily.signal, weekly.signal, monthly.signal]
  const allSame = signals.every(s => s === signals[0])
  const hasOpposing = signals.includes('AL') && signals.includes('SAT')
  const alignment = allSame && signals[0] !== 'BEKLE' ? 'UYUMLU' : hasOpposing ? 'ZİT' : 'KARMA'

  return { daily, weekly, monthly, consensus, consensusScore, alignment }
}

// ========== Bollinger Bands ==========

export interface BollingerBands {
  upper: number
  middle: number
  lower: number
  width: number
  percentB: number
  squeeze: boolean
}

export function calculateBollingerBands(closes: number[], period: number = 20, multiplier: number = 2): BollingerBands | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
  const stdDev = Math.sqrt(variance)
  
  const upper = mean + multiplier * stdDev
  const lower = mean - multiplier * stdDev
  const currentPrice = closes[closes.length - 1]
  const width = mean > 0 ? ((upper - lower) / mean) * 100 : 0
  const percentB = (upper - lower) > 0 ? (currentPrice - lower) / (upper - lower) : 0.5
  const squeeze = width < 4

  return {
    upper: parseFloat(upper.toFixed(4)),
    middle: parseFloat(mean.toFixed(4)),
    lower: parseFloat(lower.toFixed(4)),
    width: parseFloat(width.toFixed(2)),
    percentB: parseFloat(percentB.toFixed(3)),
    squeeze,
  }
}

// ========== MACD Crossover Detection ==========

export interface MACDCrossover {
  macd: number
  signal: number
  histogram: number
  crossover: 'BULLISH' | 'BEARISH' | null
  histogramTrend: 'EXPANDING' | 'CONTRACTING' | 'FLAT'
}

export function detectMACDCrossover(closes: number[], fast = 12, slow = 26, sig = 9): MACDCrossover | null {
  if (closes.length < slow + sig + 2) return null
  
  const multF = 2 / (fast + 1)
  const multS = 2 / (slow + 1)
  let emaF = closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast
  let emaS = closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow
  const macdSeries: number[] = []
  
  for (let i = 1; i < closes.length; i++) {
    emaF = (closes[i] - emaF) * multF + emaF
    emaS = (closes[i] - emaS) * multS + emaS
    if (i >= slow - 1) macdSeries.push(emaF - emaS)
  }
  
  if (macdSeries.length < sig + 2) return null
  
  const sigMult = 2 / (sig + 1)
  let sigEma = macdSeries.slice(0, sig).reduce((a, b) => a + b, 0) / sig
  const histSeries: number[] = []
  
  for (let i = sig; i < macdSeries.length; i++) {
    sigEma = (macdSeries[i] - sigEma) * sigMult + sigEma
    histSeries.push(macdSeries[i] - sigEma)
  }
  
  if (histSeries.length < 3) return null
  
  const currentHist = histSeries[histSeries.length - 1]
  const prevHist = histSeries[histSeries.length - 2]
  
  let crossover: 'BULLISH' | 'BEARISH' | null = null
  if (prevHist <= 0 && currentHist > 0) crossover = 'BULLISH'
  else if (prevHist >= 0 && currentHist < 0) crossover = 'BEARISH'
  
  const absChange = Math.abs(currentHist) - Math.abs(prevHist)
  const histogramTrend: 'EXPANDING' | 'CONTRACTING' | 'FLAT' = 
    absChange > 0.001 ? 'EXPANDING' : absChange < -0.001 ? 'CONTRACTING' : 'FLAT'
  
  return {
    macd: parseFloat(macdSeries[macdSeries.length - 1].toFixed(4)),
    signal: parseFloat(sigEma.toFixed(4)),
    histogram: parseFloat(currentHist.toFixed(4)),
    crossover,
    histogramTrend,
  }
}

// ========== Trend Strength ==========

export function calculateTrendStrength(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null
  let upMoves = 0
  const recent = closes.slice(-period - 1)
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i - 1]) upMoves++
  }
  const ratio = upMoves / period
  return parseFloat((Math.abs(ratio - 0.5) * 200).toFixed(1))
}

// ========== Enhanced Scanner Analysis ==========

export interface EnhancedTechnicalData extends TechnicalData {
  bollinger: BollingerBands | null
  macdCrossover: MACDCrossover | null
  trendStrength: number | null
  confirmingIndicators: number
  reliability: 'DÜŞÜK' | 'ORTA' | 'YÜKSEK' | 'ÇOK_YÜKSEK'
}

export function analyzeEnhancedTechnicals(
  closes: number[],
  volumes: number[],
  currentVolume: number
): EnhancedTechnicalData {
  const rsi14 = calculateRSI(closes, 14)
  const sma20 = calculateSMA(closes, 20)
  const sma50 = calculateSMA(closes, 50)
  const avgVolume20 = calculateAvgVolume(volumes, 20)
  const bollinger = calculateBollingerBands(closes, 20, 2)
  const macdCrossover = detectMACDCrossover(closes)
  const trendStrength = calculateTrendStrength(closes)

  let rsiSignal: TechnicalData['rsiSignal'] = null
  if (rsi14 !== null) {
    if (rsi14 >= 70) rsiSignal = 'AŞIRI_ALIM'
    else if (rsi14 <= 30) rsiSignal = 'AŞIRI_SATIM'
    else rsiSignal = 'NÖTR'
  }

  let maSignal: TechnicalData['maSignal'] = null
  const currentPrice = closes.length > 0 ? closes[closes.length - 1] : 0
  if (sma20 !== null && sma50 !== null) {
    if (sma20 > sma50 && currentPrice > sma20) maSignal = 'GOLDEN_CROSS'
    else if (sma20 < sma50 && currentPrice < sma20) maSignal = 'DEATH_CROSS'
    else if (currentPrice > sma20) maSignal = 'ABOVE_MA20'
    else maSignal = 'BELOW_MA20'
  } else if (sma20 !== null) {
    if (currentPrice > sma20) maSignal = 'ABOVE_MA20'
    else maSignal = 'BELOW_MA20'
  }

  const volumeSpike = avgVolume20 !== null && avgVolume20 > 0 && currentVolume > avgVolume20 * 2

  // Count confirming indicators
  let bullCount = 0
  let bearCount = 0
  
  if (rsi14 !== null) {
    if (rsi14 <= 35) bullCount++
    else if (rsi14 >= 65) bearCount++
  }
  if (maSignal === 'GOLDEN_CROSS' || maSignal === 'ABOVE_MA20') bullCount++
  else if (maSignal === 'DEATH_CROSS' || maSignal === 'BELOW_MA20') bearCount++
  
  if (macdCrossover) {
    if (macdCrossover.crossover === 'BULLISH' || macdCrossover.histogram > 0) bullCount++
    else if (macdCrossover.crossover === 'BEARISH' || macdCrossover.histogram < 0) bearCount++
  }
  
  if (bollinger) {
    if (bollinger.percentB <= 0.15) bullCount++
    else if (bollinger.percentB >= 0.85) bearCount++
  }
  
  if (volumeSpike) {
    if (currentPrice > (closes.length > 1 ? closes[closes.length - 2] : currentPrice)) bullCount++
    else bearCount++
  }

  const confirmingIndicators = Math.max(bullCount, bearCount)
  
  let reliability: EnhancedTechnicalData['reliability'] = 'DÜŞÜK'
  if (confirmingIndicators >= 4) reliability = 'ÇOK_YÜKSEK'
  else if (confirmingIndicators >= 3) reliability = 'YÜKSEK'
  else if (confirmingIndicators >= 2) reliability = 'ORTA'

  return {
    rsi14, sma20, sma50, maSignal, rsiSignal, volumeSpike, avgVolume20,
    bollinger, macdCrossover, trendStrength, confirmingIndicators, reliability,
  }
}

// ========== Legacy scanner function ==========

export function analyzeTechnicals(
  closes: number[],
  volumes: number[],
  currentVolume: number
): TechnicalData {
  const result = analyzeEnhancedTechnicals(closes, volumes, currentVolume)
  return {
    rsi14: result.rsi14,
    sma20: result.sma20,
    sma50: result.sma50,
    maSignal: result.maSignal,
    rsiSignal: result.rsiSignal,
    volumeSpike: result.volumeSpike,
    avgVolume20: result.avgVolume20,
  }
}