// Takas (Settlement) Analysis - Volume-based institutional/retail flow estimation
// Uses OHLCV data to calculate accumulation/distribution indicators

export interface TakasFlowData {
  date: string
  price: number
  volume: number
  adLine: number        // Accumulation/Distribution Line
  obv: number           // On-Balance Volume
  mfi: number | null    // Money Flow Index (14)
  cmf: number | null    // Chaikin Money Flow (20)
  institutionalFlow: number  // Estimated institutional net flow (-100 to +100)
  retailFlow: number         // Estimated retail net flow (-100 to +100)
  blockTradeRatio: number    // Estimated block trade percentage
}

export interface TakasAnalysisResult {
  symbol: string
  period: string
  flowData: TakasFlowData[]
  summary: {
    adTrend: 'BİRİKİM' | 'DAĞITIM' | 'NÖTR'
    obvTrend: 'YUKARI' | 'AŞAĞI' | 'YATAY'
    mfiSignal: 'AŞIRI_ALIM' | 'AŞIRI_SATIM' | 'NÖTR'
    cmfSignal: 'PARA_GİRİŞİ' | 'PARA_ÇIKIŞI' | 'NÖTR'
    institutionalBias: 'ALIM' | 'SATIM' | 'NÖTR'
    overallSignal: 'BİRİKİM' | 'DAĞITIM' | 'BELİRSİZ'
    confidence: number
    description: string
  }
  // Latest values
  latestMFI: number | null
  latestCMF: number | null
  latestAD: number
  latestOBV: number
  adChange5d: number   // AD Line 5-day change %
  obvChange5d: number  // OBV 5-day change %
  avgVolume20: number
  currentVolume: number
  volumeRatio: number  // current / avg
}

// Money Flow Multiplier: [(Close - Low) - (High - Close)] / (High - Low)
function moneyFlowMultiplier(close: number, high: number, low: number): number {
  const range = high - low
  if (range === 0) return 0
  return ((close - low) - (high - close)) / range
}

// Accumulation/Distribution Line
function calculateADLine(ohlcv: { close: number; high: number; low: number; volume: number }[]): number[] {
  const ad: number[] = []
  let cumAD = 0
  for (const bar of ohlcv) {
    const mfm = moneyFlowMultiplier(bar.close, bar.high, bar.low)
    const mfv = mfm * bar.volume
    cumAD += mfv
    ad.push(cumAD)
  }
  return ad
}

// On-Balance Volume
function calculateOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv.push(obv[i - 1] + volumes[i])
    } else if (closes[i] < closes[i - 1]) {
      obv.push(obv[i - 1] - volumes[i])
    } else {
      obv.push(obv[i - 1])
    }
  }
  return obv
}

// Money Flow Index (14 period)
function calculateMFI(ohlcv: { close: number; high: number; low: number; volume: number }[], period: number = 14): (number | null)[] {
  const mfi: (number | null)[] = []
  const typicalPrices = ohlcv.map(b => (b.high + b.low + b.close) / 3)
  const rawMoneyFlow = typicalPrices.map((tp, i) => tp * ohlcv[i].volume)

  for (let i = 0; i < ohlcv.length; i++) {
    if (i < period) {
      mfi.push(null)
      continue
    }
    let posFlow = 0
    let negFlow = 0
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        posFlow += rawMoneyFlow[j]
      } else {
        negFlow += rawMoneyFlow[j]
      }
    }
    if (negFlow === 0) { mfi.push(100); continue }
    const moneyRatio = posFlow / negFlow
    mfi.push(100 - (100 / (1 + moneyRatio)))
  }
  return mfi
}

// Chaikin Money Flow (20 period)
function calculateCMF(ohlcv: { close: number; high: number; low: number; volume: number }[], period: number = 20): (number | null)[] {
  const cmf: (number | null)[] = []
  for (let i = 0; i < ohlcv.length; i++) {
    if (i < period - 1) {
      cmf.push(null)
      continue
    }
    let mfvSum = 0
    let volSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const mfm = moneyFlowMultiplier(ohlcv[j].close, ohlcv[j].high, ohlcv[j].low)
      mfvSum += mfm * ohlcv[j].volume
      volSum += ohlcv[j].volume
    }
    cmf.push(volSum === 0 ? 0 : mfvSum / volSum)
  }
  return cmf
}

// Estimate institutional vs retail flow based on volume patterns
function estimateInstitutionalFlow(
  ohlcv: { close: number; high: number; low: number; volume: number }[],
  avgVolume20: number
): { institutional: number[]; retail: number[]; blockRatio: number[] } {
  const institutional: number[] = []
  const retail: number[] = []
  const blockRatio: number[] = []

  for (let i = 0; i < ohlcv.length; i++) {
    const bar = ohlcv[i]
    const volRatio = avgVolume20 > 0 ? bar.volume / avgVolume20 : 1
    const range = bar.high - bar.low
    const bodySize = Math.abs(bar.close - (i > 0 ? ohlcv[i - 1].close : bar.close))
    const priceRange = bar.close > 0 ? range / bar.close : 0

    // High volume + small price range = institutional accumulation/distribution
    // High volume + large price range = retail panic
    // Low volume + small range = retail indifference
    // Low volume + large range = institutional positioning

    let instScore = 0
    let retScore = 0

    if (volRatio > 1.5 && priceRange < 0.02) {
      // High volume, tight range — institutional activity
      instScore = Math.min(80, volRatio * 30)
      retScore = -20
    } else if (volRatio > 1.5 && priceRange > 0.03) {
      // High volume, wide range — retail panic/fomo
      retScore = Math.min(80, volRatio * 25)
      instScore = -10
    } else if (volRatio < 0.7 && priceRange > 0.02) {
      // Low volume, price movement — institutional quiet positioning
      instScore = 30
      retScore = -15
    } else {
      instScore = (volRatio - 1) * 20
      retScore = (1 - volRatio) * 15
    }

    // Direction: is it buying or selling?
    const mfm = moneyFlowMultiplier(bar.close, bar.high, bar.low)
    instScore *= mfm > 0 ? 1 : -1
    retScore *= mfm > 0 ? -0.5 : 0.5  // Retail often contrarian short-term

    institutional.push(Math.max(-100, Math.min(100, instScore)))
    retail.push(Math.max(-100, Math.min(100, retScore)))

    // Block trade ratio estimate: high volume days likely have more block trades
    const blockEst = Math.min(0.8, Math.max(0.1, volRatio > 1.2 ? 0.3 + (volRatio - 1.2) * 0.3 : 0.15))
    blockRatio.push(blockEst * 100)
  }

  return { institutional, retail, blockRatio }
}

export function calculateTakasAnalysis(
  ohlcv: { date: string; open: number; high: number; low: number; close: number; volume: number }[],
  symbol: string,
  period: string
): TakasAnalysisResult {
  if (ohlcv.length < 20) {
    return {
      symbol, period,
      flowData: [],
      summary: {
        adTrend: 'NÖTR', obvTrend: 'YATAY', mfiSignal: 'NÖTR', cmfSignal: 'NÖTR',
        institutionalBias: 'NÖTR', overallSignal: 'BELİRSİZ', confidence: 0,
        description: 'Yetersiz veri — en az 20 günlük veri gerekli'
      },
      latestMFI: null, latestCMF: null, latestAD: 0, latestOBV: 0,
      adChange5d: 0, obvChange5d: 0, avgVolume20: 0, currentVolume: 0, volumeRatio: 0
    }
  }

  const bars = ohlcv.map(b => ({
    close: b.close, high: b.high, low: b.low, volume: b.volume
  }))

  // Calculate indicators
  const adLine = calculateADLine(bars)
  const obvLine = calculateOBV(bars.map(b => b.close), bars.map(b => b.volume))
  const mfiLine = calculateMFI(bars, 14)
  const cmfLine = calculateCMF(bars, 20)

  // Average volume (20 period)
  const last20Vols = bars.slice(-20).map(b => b.volume)
  const avgVolume20 = last20Vols.reduce((a, b) => a + b, 0) / last20Vols.length

  // Institutional flow estimates
  const flows = estimateInstitutionalFlow(bars, avgVolume20)

  // Build flow data
  const flowData: TakasFlowData[] = ohlcv.map((bar, i) => ({
    date: bar.date,
    price: bar.close,
    volume: bar.volume,
    adLine: adLine[i],
    obv: obvLine[i],
    mfi: mfiLine[i],
    cmf: cmfLine[i],
    institutionalFlow: flows.institutional[i],
    retailFlow: flows.retail[i],
    blockTradeRatio: flows.blockRatio[i],
  }))

  // Period-based lookback: how many days to look back for change calculations
  // 1G = 1 day, 1H = 5 days (1 week), 1A/3M/1Y = 5 days (default)
  const changeLookback = period === '1G' ? 1 : period === '1H' ? 5 : 5
  // How many days of institutional flow to average
  const instLookback = period === '1G' ? 2 : period === '1H' ? 5 : 5

  // Summary calculations
  const len = adLine.length
  const adRef = len > changeLookback ? adLine[len - 1 - changeLookback] : adLine[0]
  const obvRef = len > changeLookback ? obvLine[len - 1 - changeLookback] : obvLine[0]
  const latestAD = adLine[len - 1]
  const latestOBV = obvLine[len - 1]
  const adChange5d = adRef !== 0 ? ((latestAD - adRef) / Math.abs(adRef)) * 100 : 0
  const obvChange5d = obvRef !== 0 ? ((latestOBV - obvRef) / Math.abs(obvRef)) * 100 : 0

  const latestMFI = mfiLine[len - 1]
  const latestCMF = cmfLine[len - 1]
  const currentVolume = bars[len - 1].volume
  const volumeRatio = avgVolume20 > 0 ? currentVolume / avgVolume20 : 1

  // Thresholds adapt to period — shorter periods need tighter thresholds
  const adThreshold = period === '1G' ? 2 : period === '1H' ? 3 : 5
  const obvThreshold = period === '1G' ? 2 : period === '1H' ? 3 : 5
  const instThreshold = period === '1G' ? 10 : 15

  // Determine trends
  const adTrend = adChange5d > adThreshold ? 'BİRİKİM' : adChange5d < -adThreshold ? 'DAĞITIM' : 'NÖTR'
  const obvTrend = obvChange5d > obvThreshold ? 'YUKARI' : obvChange5d < -obvThreshold ? 'AŞAĞI' : 'YATAY'
  const mfiSignal = latestMFI !== null ? (latestMFI > 80 ? 'AŞIRI_ALIM' : latestMFI < 20 ? 'AŞIRI_SATIM' : 'NÖTR') : 'NÖTR'
  const cmfSignal = latestCMF !== null ? (latestCMF > 0.05 ? 'PARA_GİRİŞİ' : latestCMF < -0.05 ? 'PARA_ÇIKIŞI' : 'NÖTR') : 'NÖTR'

  // Institutional bias from lookback period
  const lastNInst = flows.institutional.slice(-instLookback)
  const avgInst = lastNInst.reduce((a, b) => a + b, 0) / lastNInst.length
  const institutionalBias = avgInst > instThreshold ? 'ALIM' : avgInst < -instThreshold ? 'SATIM' : 'NÖTR'

  // Overall signal
  let bullPoints = 0
  let bearPoints = 0
  if (adTrend === 'BİRİKİM') bullPoints += 2; else if (adTrend === 'DAĞITIM') bearPoints += 2
  if (obvTrend === 'YUKARI') bullPoints += 1; else if (obvTrend === 'AŞAĞI') bearPoints += 1
  if (mfiSignal === 'AŞIRI_SATIM') bullPoints += 1; else if (mfiSignal === 'AŞIRI_ALIM') bearPoints += 1
  if (cmfSignal === 'PARA_GİRİŞİ') bullPoints += 2; else if (cmfSignal === 'PARA_ÇIKIŞI') bearPoints += 2
  if (institutionalBias === 'ALIM') bullPoints += 2; else if (institutionalBias === 'SATIM') bearPoints += 2

  const overallSignal = bullPoints >= 4 ? 'BİRİKİM' : bearPoints >= 4 ? 'DAĞITIM' : 'BELİRSİZ'
  const confidence = Math.min(95, Math.abs(bullPoints - bearPoints) * 12 + 20)

  // Period label for descriptions
  const periodLabel = period === '1G' ? 'Günlük' : period === '1H' ? 'Haftalık' : ''
  const periodPrefix = periodLabel ? periodLabel + ' h' : 'H'

  // Build description
  const descParts: string[] = []
  if (overallSignal === 'BİRİKİM') {
    descParts.push(`${periodPrefix}acim analizi güçlü birikim sinyali veriyor.`)
    if (institutionalBias === 'ALIM') descParts.push('Kurumsal alım baskısı tespit edildi.')
    if (cmfSignal === 'PARA_GİRİŞİ') descParts.push('Para girişi pozitif.')
  } else if (overallSignal === 'DAĞITIM') {
    descParts.push(`${periodPrefix}acim analizi dağıtım sinyali veriyor.`)
    if (institutionalBias === 'SATIM') descParts.push('Kurumsal satış baskısı tespit edildi.')
    if (cmfSignal === 'PARA_ÇIKIŞI') descParts.push('Para çıkışı negatif.')
  } else {
    descParts.push(`${periodPrefix}acim analizinde belirgin bir sinyal yok.`)
  }
  if (volumeRatio > 1.5) descParts.push(`Hacim ortalamanın ${volumeRatio.toFixed(1)}x üzerinde.`)
  else if (volumeRatio < 0.5) descParts.push('Hacim ortalamanın altında — düşük ilgi.')

  return {
    symbol, period,
    flowData,
    summary: {
      adTrend, obvTrend, mfiSignal, cmfSignal, institutionalBias, overallSignal, confidence,
      description: descParts.join(' ')
    },
    latestMFI, latestCMF, latestAD, latestOBV,
    adChange5d, obvChange5d, avgVolume20, currentVolume, volumeRatio
  }
}
