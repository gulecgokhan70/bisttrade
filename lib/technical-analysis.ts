// Technical Analysis Library for BIST Trade

export interface OHLCV {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp?: string
  date?: string
}

// Simple Moving Average
export function calcSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      const slice = data.slice(i - period + 1, i + 1)
      const avg = slice.reduce((a, b) => a + b, 0) / period
      result.push(parseFloat(avg.toFixed(2)))
    }
  }
  return result
}

// Exponential Moving Average
export function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const multiplier = 2 / (period + 1)
  let prevEma: number | null = null

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (i === period - 1) {
      // First EMA is SMA
      const sma = data.slice(0, period).reduce((a, b) => a + b, 0) / period
      prevEma = sma
      result.push(parseFloat(sma.toFixed(2)))
    } else {
      const emaVal: number = (data[i] - (prevEma ?? 0)) * multiplier + (prevEma ?? 0)
      prevEma = emaVal
      result.push(parseFloat(emaVal.toFixed(2)))
    }
  }
  return result
}

// Relative Strength Index
export function calcRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  if (data.length < period + 1) return data.map(() => null)

  let avgGain = 0
  let avgLoss = 0

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1]
    if (change >= 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  // Fill nulls for first period entries
  for (let i = 0; i <= period; i++) {
    if (i < period) result.push(null)
    else {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)))
    }
  }

  // Calculate remaining RSI values
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    const gain = change >= 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(parseFloat((100 - 100 / (1 + rs)).toFixed(2)))
  }
  return result
}

// MACD
export function calcMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = calcEMA(data, fastPeriod)
  const slowEma = calcEMA(data, slowPeriod)

  const macdLine: (number | null)[] = fastEma.map((f, i) => {
    if (f === null || slowEma[i] === null) return null
    return parseFloat((f - (slowEma[i] ?? 0)).toFixed(4))
  })

  const macdValues = macdLine.filter((v): v is number => v !== null)
  const signalEma = calcEMA(macdValues, signalPeriod)

  // Align signal with macd
  const signal: (number | null)[] = []
  let signalIdx = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signal.push(null)
    } else {
      signal.push(signalEma[signalIdx] ?? null)
      signalIdx++
    }
  }

  const histogram: (number | null)[] = macdLine.map((m, i) => {
    if (m === null || signal[i] === null) return null
    return parseFloat((m - (signal[i] ?? 0)).toFixed(4))
  })

  return { macd: macdLine, signal, histogram }
}

// Bollinger Bands
export function calcBollinger(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(data, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []

  for (let i = 0; i < data.length; i++) {
    if (middle[i] === null) {
      upper.push(null)
      lower.push(null)
    } else {
      const slice = data.slice(i - period + 1, i + 1)
      const mean = middle[i] as number
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
      const sd = Math.sqrt(variance)
      upper.push(parseFloat((mean + stdDev * sd).toFixed(2)))
      lower.push(parseFloat((mean - stdDev * sd).toFixed(2)))
    }
  }

  return { upper, middle, lower }
}

// Momentum / Rate of Change
export function calcROC(data: number[], period: number): (number | null)[] {
  return data.map((val, i) => {
    if (i < period) return null
    const prev = data[i - period]
    return prev !== 0 ? parseFloat(((val - prev) / prev * 100).toFixed(4)) : null
  })
}

// Volume Moving Average
export function calcVolumeMA(volumes: number[], period: number): (number | null)[] {
  return calcSMA(volumes, period)
}

// VWAP-like calculation (Volume Weighted Average Price approximation)
export function calcVWAP(data: OHLCV[]): (number | null)[] {
  let cumulVP = 0
  let cumulVol = 0
  return data.map((d) => {
    const tp = (d.high + d.low + d.close) / 3
    cumulVP += tp * d.volume
    cumulVol += d.volume
    if (cumulVol === 0) return null
    return parseFloat((cumulVP / cumulVol).toFixed(2))
  })
}

// Stochastic RSI
export function calcStochRSI(data: number[], rsiPeriod: number = 14, stochPeriod: number = 14): (number | null)[] {
  const rsiValues = calcRSI(data, rsiPeriod)
  const result: (number | null)[] = []
  for (let i = 0; i < rsiValues.length; i++) {
    if (i < rsiPeriod + stochPeriod - 1 || rsiValues[i] === null) {
      result.push(null)
      continue
    }
    const window = rsiValues.slice(i - stochPeriod + 1, i + 1).filter((v): v is number => v !== null)
    if (window.length < stochPeriod) { result.push(null); continue }
    const minRSI = Math.min(...window)
    const maxRSI = Math.max(...window)
    const range = maxRSI - minRSI
    result.push(range === 0 ? 50 : parseFloat(((rsiValues[i]! - minRSI) / range * 100).toFixed(2)))
  }
  return result
}

// Generate trading signal optimized for DAILY trading
export function generateSignal(
  data: OHLCV[],
  strategy: string
): { signal: 'BUY' | 'SELL' | 'HOLD'; reason: string; confidence: number } {
  if (data.length < 20) return { signal: 'HOLD', reason: 'Yetersiz veri', confidence: 0 }

  const closes = data.map(d => d.close)
  const volumes = data.map(d => d.volume)
  const highs = data.map(d => d.high)
  const lows = data.map(d => d.low)
  const lastPrice = closes[closes.length - 1]
  const lastVol = volumes[volumes.length - 1]

  // Volume confirmation helper
  const volMA = calcVolumeMA(volumes, 10)
  const avgVol = volMA[volMA.length - 1]
  const volConfirm = avgVol ? lastVol > avgVol * 1.1 : false // Volume above average

  switch (strategy) {
    case 'SMA_CROSSOVER': {
      // Daily: Use fast 5/10 crossover + 20 SMA trend filter
      const sma5 = calcSMA(closes, 5)
      const sma10 = calcSMA(closes, 10)
      const sma20 = calcSMA(closes, 20)
      const curr5 = sma5[sma5.length - 1]
      const prev5 = sma5[sma5.length - 2]
      const curr10 = sma10[sma10.length - 1]
      const prev10 = sma10[sma10.length - 2]
      const curr20 = sma20[sma20.length - 1]
      if (!curr5 || !curr10 || !prev5 || !prev10 || !curr20) {
        return { signal: 'HOLD', reason: 'Hesaplama bekleniyor', confidence: 0 }
      }

      const crossed_up = prev5 <= prev10 && curr5 > curr10
      const crossed_down = prev5 >= prev10 && curr5 < curr10
      const trendUp = lastPrice > curr20
      const trendDown = lastPrice < curr20

      if (crossed_up && trendUp) {
        const conf = volConfirm ? 82 : 68
        return { signal: 'BUY', reason: `SMA(5) SMA(10) yukarı kesti, trend yukarı${volConfirm ? ' + hacim teyidi' : ''}`, confidence: conf }
      }
      if (crossed_down && trendDown) {
        const conf = volConfirm ? 80 : 66
        return { signal: 'SELL', reason: `SMA(5) SMA(10) aşağı kesti, trend aşağı${volConfirm ? ' + hacim teyidi' : ''}`, confidence: conf }
      }
      if (crossed_up) return { signal: 'BUY', reason: 'SMA(5) SMA(10) yukarı kesti (trend karşı)', confidence: 52 }
      if (crossed_down) return { signal: 'SELL', reason: 'SMA(5) SMA(10) aşağı kesti (trend karşı)', confidence: 52 }

      // Proximity alert
      const gap = Math.abs(curr5 - curr10) / curr10 * 100
      if (gap < 0.3 && trendUp) return { signal: 'HOLD', reason: `SMA yakınsama (boğa beklentisi), mesafe %${gap.toFixed(2)}`, confidence: 45 }
      if (gap < 0.3 && trendDown) return { signal: 'HOLD', reason: `SMA yakınsama (ayı beklentisi), mesafe %${gap.toFixed(2)}`, confidence: 45 }

      return { signal: 'HOLD', reason: `SMA(5): ₺${curr5.toFixed(2)}, SMA(10): ₺${curr10.toFixed(2)}, Trend: ${trendUp ? '↑' : '↓'}`, confidence: 25 }
    }
    case 'RSI_STRATEGY': {
      // Daily: Use RSI(9) for faster signals + StochRSI for precision
      const rsi = calcRSI(closes, 9)
      const stochRsi = calcStochRSI(closes, 9, 9)
      const currRsi = rsi[rsi.length - 1]
      const prevRsi = rsi[rsi.length - 2]
      const currStoch = stochRsi[stochRsi.length - 1]
      if (!currRsi) return { signal: 'HOLD', reason: 'RSI hesaplanıyor', confidence: 0 }

      // Divergence check
      const price5ago = closes[closes.length - 6] ?? lastPrice
      const rsi5ago = rsi[rsi.length - 6] ?? currRsi
      const priceFalling = lastPrice < price5ago
      const rsiRising = currRsi > rsi5ago
      const priceRising = lastPrice > price5ago
      const rsiFalling = currRsi < rsi5ago

      if (currRsi < 35) {
        const reasons: string[] = [`RSI(9): ${currRsi.toFixed(1)} (Aşırı Satım)`]
        let conf = 65
        if (prevRsi && currRsi > prevRsi) { reasons.push('RSI dönüş sinyali ↑'); conf += 10 }
        if (currStoch && currStoch < 20) { reasons.push(`StochRSI: ${currStoch.toFixed(0)}`); conf += 5 }
        if (priceFalling && rsiRising) { reasons.push('Boğa uyumsuzluğu'); conf += 10 }
        if (volConfirm) { reasons.push('hacim teyidi'); conf += 5 }
        return { signal: 'BUY', reason: reasons.join(' · '), confidence: Math.min(conf, 90) }
      }
      if (currRsi > 65) {
        const reasons: string[] = [`RSI(9): ${currRsi.toFixed(1)} (Aşırı Alım)`]
        let conf = 65
        if (prevRsi && currRsi < prevRsi) { reasons.push('RSI dönüş sinyali ↓'); conf += 10 }
        if (currStoch && currStoch > 80) { reasons.push(`StochRSI: ${currStoch.toFixed(0)}`); conf += 5 }
        if (priceRising && rsiFalling) { reasons.push('Ayı uyumsuzluğu'); conf += 10 }
        // Hacim doğrulaması: düşük hacimle yüksek RSI sahte olabilir
        if (!volConfirm) { reasons.push('⚠️ Hacim teyidi yok'); conf -= 15 }
        return { signal: 'SELL', reason: reasons.join(' · '), confidence: Math.min(conf, 90) }
      }
      return { signal: 'HOLD', reason: `RSI(9): ${currRsi.toFixed(1)} · StochRSI: ${currStoch?.toFixed(0) ?? 'N/A'} (Nötr)`, confidence: 30 }
    }
    case 'RSI_LONG': {
      // Long-term: RSI(14) standard + SMA(50) trend filter + StochRSI(14,14) for confirmation
      const rsi = calcRSI(closes, 14)
      const stochRsi = calcStochRSI(closes, 14, 14)
      const sma50 = calcSMA(closes, 50)
      const sma20 = calcSMA(closes, 20)
      const currRsi = rsi[rsi.length - 1]
      const prevRsi = rsi[rsi.length - 2]
      const currStoch = stochRsi[stochRsi.length - 1]
      const curr50 = sma50[sma50.length - 1]
      const curr20 = sma20[sma20.length - 1]
      if (!currRsi) return { signal: 'HOLD', reason: 'RSI(14) hesaplanıyor', confidence: 0 }

      const trendUp = curr50 ? lastPrice > curr50 : (curr20 ? lastPrice > curr20 : true)
      const trendDown = curr50 ? lastPrice < curr50 : (curr20 ? lastPrice < curr20 : true)

      // Divergence check (10-bar lookback for longer timeframe)
      const price10ago = closes[closes.length - 11] ?? lastPrice
      const rsi10ago = rsi[rsi.length - 11] ?? currRsi
      const bullDiv = lastPrice < price10ago && currRsi > rsi10ago // price falling but RSI rising
      const bearDiv = lastPrice > price10ago && currRsi < rsi10ago // price rising but RSI falling

      if (currRsi < 30) {
        const reasons: string[] = [`RSI(14): ${currRsi.toFixed(1)} (Aşırı Satım)`]
        let conf = 68
        if (trendUp) { reasons.push('trend yukarı ↑'); conf += 8 }
        if (prevRsi && currRsi > prevRsi) { reasons.push('RSI dönüş ↑'); conf += 8 }
        if (currStoch !== null && currStoch < 20) { reasons.push(`StochRSI(14): ${currStoch.toFixed(0)}`); conf += 5 }
        if (bullDiv) { reasons.push('Boğa uyumsuzluğu'); conf += 10 }
        if (volConfirm) { reasons.push('hacim teyidi'); conf += 5 }
        return { signal: 'BUY', reason: reasons.join(' · '), confidence: Math.min(conf, 92) }
      }
      if (currRsi > 70) {
        const reasons: string[] = [`RSI(14): ${currRsi.toFixed(1)} (Aşırı Alım)`]
        let conf = 68
        if (trendDown) { reasons.push('trend aşağı ↓'); conf += 8 }
        if (prevRsi && currRsi < prevRsi) { reasons.push('RSI dönüş ↓'); conf += 8 }
        if (currStoch !== null && currStoch > 80) { reasons.push(`StochRSI(14): ${currStoch.toFixed(0)}`); conf += 5 }
        if (bearDiv) { reasons.push('Ayı uyumsuzluğu'); conf += 10 }
        if (!volConfirm) { reasons.push('⚠️ Hacim teyidi yok'); conf -= 15 }
        return { signal: 'SELL', reason: reasons.join(' · '), confidence: Math.min(conf, 92) }
      }
      // Mid-range signals with trend
      if (currRsi < 40 && trendUp && (currStoch !== null && currStoch < 30)) {
        return { signal: 'BUY', reason: `RSI(14): ${currRsi.toFixed(1)} düşük + trend↑ + StochRSI ${currStoch?.toFixed(0)}`, confidence: 55 }
      }
      if (currRsi > 60 && trendDown && (currStoch !== null && currStoch > 70)) {
        return { signal: 'SELL', reason: `RSI(14): ${currRsi.toFixed(1)} yüksek + trend↓ + StochRSI ${currStoch?.toFixed(0)}`, confidence: 55 }
      }
      return { signal: 'HOLD', reason: `RSI(14): ${currRsi.toFixed(1)} · StochRSI(14): ${currStoch?.toFixed(0) ?? 'N/A'} · Trend: ${trendUp ? '↑' : trendDown ? '↓' : '→'} (Nötr)`, confidence: 30 }
    }
    case 'MACD_STRATEGY': {
      // Daily: Fast MACD (5,13,6) for quicker signals
      const { macd, signal: sig, histogram } = calcMACD(closes, 5, 13, 6)
      const currH = histogram[histogram.length - 1]
      const prevH = histogram[histogram.length - 2]
      const prev2H = histogram[histogram.length - 3]
      const currM = macd[macd.length - 1]
      const currS = sig[sig.length - 1]
      if (currH === null || prevH === null) return { signal: 'HOLD', reason: 'MACD hesaplanıyor', confidence: 0 }

      // Zero-line crossover
      const zeroCross_up = prevH < 0 && currH > 0
      const zeroCross_down = prevH > 0 && currH < 0
      // Histogram momentum (3 bars)
      const histMomentum_up = prev2H !== null && prevH !== null && currH > prevH && prevH > prev2H
      const histMomentum_down = prev2H !== null && prevH !== null && currH < prevH && prevH < prev2H

      if (zeroCross_up) {
        const conf = volConfirm ? 78 : 65
        return { signal: 'BUY', reason: `MACD histogram pozitife döndü${histMomentum_up ? ' + ivme artıyor' : ''}${volConfirm ? ' + hacim teyidi' : ''}`, confidence: conf }
      }
      if (zeroCross_down) {
        const conf = volConfirm ? 76 : 63
        return { signal: 'SELL', reason: `MACD histogram negatife döndü${histMomentum_down ? ' + ivme artıyor' : ''}`, confidence: conf }
      }
      if (histMomentum_up && currH > 0) return { signal: 'BUY', reason: 'MACD histogram ivmesi artıyor ↑', confidence: 55 }
      if (histMomentum_down && currH < 0) return { signal: 'SELL', reason: 'MACD histogram ivmesi artıyor ↓', confidence: 55 }

      return { signal: 'HOLD', reason: `MACD(5,13,6) Histogram: ${currH.toFixed(4)}`, confidence: 25 }
    }
    case 'BOLLINGER_STRATEGY': {
      // Daily: Tighter Bollinger (15, 1.8) for daily bands
      const { upper, middle, lower } = calcBollinger(closes, 15, 1.8)
      const currU = upper[upper.length - 1]
      const currM = middle[middle.length - 1]
      const currL = lower[lower.length - 1]
      const prevClose = closes[closes.length - 2]
      if (!currU || !currM || !currL) return { signal: 'HOLD', reason: 'Bollinger hesaplanıyor', confidence: 0 }

      const bandWidth = ((currU - currL) / currM * 100)
      const pricePos = ((lastPrice - currL) / (currU - currL)) * 100 // 0=alt band, 100=üst band

      // Band bounce signals
      if (lastPrice <= currL) {
        const bounce = prevClose < currL && lastPrice > prevClose
        const conf = bounce ? (volConfirm ? 80 : 68) : (volConfirm ? 70 : 58)
        return { signal: 'BUY', reason: `Fiyat alt bandda (₺${currL.toFixed(2)})${bounce ? ' + sıçrama sinyali' : ''}${volConfirm ? ' + hacim teyidi' : ''} · Bant genişliği: %${bandWidth.toFixed(1)}`, confidence: conf }
      }
      if (lastPrice >= currU) {
        const reject = prevClose > currU && lastPrice < prevClose
        const conf = reject ? (volConfirm ? 78 : 66) : (volConfirm ? 68 : 56)
        return { signal: 'SELL', reason: `Fiyat üst bandda (₺${currU.toFixed(2)})${reject ? ' + ret sinyali' : ''} · Bant genişliği: %${bandWidth.toFixed(1)}`, confidence: conf }
      }

      // Squeeze detection (low volatility = potential breakout)
      if (bandWidth < 3) {
        return { signal: 'HOLD', reason: `Bollinger sıkışması! Bant genişliği: %${bandWidth.toFixed(1)} — kırılım bekleniyor`, confidence: 50 }
      }

      return { signal: 'HOLD', reason: `Fiyat pozisyonu: %${pricePos.toFixed(0)} · Bant genişliği: %${bandWidth.toFixed(1)}`, confidence: 25 }
    }
    case 'COMBINED': {
      // Daily combined: RSI(9) + SMA(5/10) + fast MACD + Bollinger + Volume + Momentum
      const rsi = calcRSI(closes, 9)
      const sma5 = calcSMA(closes, 5)
      const sma10 = calcSMA(closes, 10)
      const sma20 = calcSMA(closes, 20)
      const { histogram } = calcMACD(closes, 5, 13, 6)
      const { upper, lower } = calcBollinger(closes, 15, 1.8)
      const roc = calcROC(closes, 3) // 3-day momentum

      const currRsi = rsi[rsi.length - 1] ?? 50
      const curr5 = sma5[sma5.length - 1] ?? lastPrice
      const curr10 = sma10[sma10.length - 1] ?? lastPrice
      const curr20 = sma20[sma20.length - 1] ?? lastPrice
      const currH = histogram[histogram.length - 1] ?? 0
      const currU = upper[upper.length - 1]
      const currL = lower[lower.length - 1]
      const momentum = roc[roc.length - 1] ?? 0

      let score = 0
      const reasons: string[] = []

      // RSI (weight: 2) - hacim doğrulaması ile
      if (currRsi < 35) { score += 2; reasons.push(`RSI ${currRsi.toFixed(0)} aşırı satım`) }
      else if (currRsi > 65) {
        if (volConfirm) { score -= 2; reasons.push(`RSI ${currRsi.toFixed(0)} aşırı alım (hacim teyitli)`) }
        else { score -= 1; reasons.push(`⚠️ RSI ${currRsi.toFixed(0)} aşırı alım (hacim zayıf)`) }
      }
      else if (currRsi < 45) { score += 0.5; reasons.push(`RSI ${currRsi.toFixed(0)} düşük`) }
      else if (currRsi > 55) { score -= 0.5; reasons.push(`RSI ${currRsi.toFixed(0)} yüksek`) }

      // SMA crossover (weight: 1.5)
      if (curr5 > curr10) { score += 1.5; reasons.push('SMA(5)>SMA(10)') }
      else { score -= 1.5; reasons.push('SMA(5)<SMA(10)') }

      // Trend filter (weight: 1)
      if (lastPrice > curr20) { score += 1; reasons.push('trend↑') }
      else { score -= 1; reasons.push('trend↓') }

      // MACD (weight: 1)
      if (currH > 0) { score += 1; reasons.push('MACD+') }
      else { score -= 1; reasons.push('MACD-') }

      // Bollinger position (weight: 1)
      if (currL && lastPrice <= currL) { score += 1; reasons.push('alt bant') }
      else if (currU && lastPrice >= currU) { score -= 1; reasons.push('üst bant') }

      // Momentum (weight: 0.5)
      if (momentum > 1) { score += 0.5; reasons.push(`ivme +%${momentum.toFixed(1)}`) }
      else if (momentum < -1) { score -= 0.5; reasons.push(`ivme -%${Math.abs(momentum).toFixed(1)}`) }

      // Volume confirmation (weight: 0.5)
      if (volConfirm) { score += (score > 0 ? 0.5 : -0.5); reasons.push('hacim↑') }

      const absScore = Math.abs(score)
      const confidence = Math.min(Math.round(absScore * 12 + 15), 92)
      if (score >= 2.5) return { signal: 'BUY', reason: reasons.join(' · '), confidence }
      if (score <= -2.5) return { signal: 'SELL', reason: reasons.join(' · '), confidence }
      return { signal: 'HOLD', reason: reasons.join(' · '), confidence: Math.min(confidence, 45) }
    }
    default:
      return { signal: 'HOLD', reason: 'Bilinmeyen strateji', confidence: 0 }
  }
}
