// Whale (Balina) Analysis - Detect large institutional/whale activity from volume patterns
// Uses OHLCV data to estimate whale entry/exit points and activity scores

export interface WhaleEvent {
  date: string
  type: 'ENTRY' | 'EXIT'
  strength: number // 0-100
  price: number
  volume: number
  volumeRatio: number // vs 20-day avg
  description: string
}

export interface WhaleScore {
  score: number // 0-100
  level: 'YÜKSEK' | 'ORTA' | 'DÜŞÜK'
  trend: 'ARTIYOR' | 'AZALIYOR' | 'STABIL'
}

export interface WhaleAnalysisResult {
  symbol: string
  whaleScore: WhaleScore
  events: WhaleEvent[]
  recentActivity: string // description
  avgVolume20: number
  currentVolume: number
  volumeRatio: number
  accumulationDays: number  // last 20 days with whale accumulation signal
  distributionDays: number  // last 20 days with whale distribution signal
  netWhaleFlow: number // -100 to +100
}

function moneyFlowMultiplier(close: number, high: number, low: number): number {
  const range = high - low
  if (range === 0) return 0
  return ((close - low) - (high - close)) / range
}

export type WhaleMode = 'daily' | 'intraday'

export function analyzeWhaleActivity(
  ohlcv: { date: string; open: number; high: number; low: number; close: number; volume: number }[],
  symbol: string,
  mode: WhaleMode = 'daily'
): WhaleAnalysisResult {
  const isIntraday = mode === 'intraday'
  // Intraday (5m bars): lookback=4 (~20dk), recent=6 (~30dk)
  // Daily: lookback=20 gün, recent=10 gün
  const LOOKBACK = isIntraday ? 4 : 20
  const RECENT_WINDOW = isIntraday ? 6 : 10
  const ACC_WINDOW = isIntraday ? 6 : 20

  // Intraday 5m mumlarında hacim daha düzensiz, eşikleri düşür
  const MASSIVE_RATIO = isIntraday ? 2.5 : 3
  const STEALTH_RATIO = isIntraday ? 1.8 : 2
  const STEALTH_RANGE = isIntraday ? 0.005 : 0.015
  const STRONG_RATIO = isIntraday ? 1.5 : 1.8
  const STRONG_MFM = isIntraday ? 0.4 : 0.5
  const ACC_RATIO = isIntraday ? 1.2 : 1.3
  const ACC_MFM = isIntraday ? 0.1 : 0.15

  const len = ohlcv.length
  if (len < LOOKBACK) {
    return {
      symbol,
      whaleScore: { score: 0, level: 'DÜŞÜK', trend: 'STABIL' },
      events: [],
      recentActivity: isIntraday ? 'Yetersiz gün içi veri' : 'Yetersiz veri',
      avgVolume20: 0, currentVolume: 0, volumeRatio: 0,
      accumulationDays: 0, distributionDays: 0, netWhaleFlow: 0,
    }
  }

  const volumes = ohlcv.map(b => b.volume)
  const events: WhaleEvent[] = []
  let accumulationDays = 0
  let distributionDays = 0

  const barLabel = isIntraday ? 'mum' : 'gün'

  for (let i = LOOKBACK; i < len; i++) {
    const bar = ohlcv[i]
    const prevBar = ohlcv[i - 1]
    const volAvg = volumes.slice(i - LOOKBACK, i).reduce((a, b) => a + b, 0) / LOOKBACK
    if (volAvg === 0) continue

    const volRatio = bar.volume / volAvg
    const range = bar.high - bar.low
    const priceRange = bar.close > 0 ? range / bar.close : 0
    const mfm = moneyFlowMultiplier(bar.close, bar.high, bar.low)
    const priceChange = prevBar.close > 0 ? (bar.close - prevBar.close) / prevBar.close : 0

    let isWhaleBar = false
    let type: 'ENTRY' | 'EXIT' = 'ENTRY'
    let strength = 0
    let description = ''

    if (volRatio >= MASSIVE_RATIO) {
      isWhaleBar = true
      strength = Math.min(95, 50 + volRatio * 10)
      if (mfm > 0.2) {
        type = 'ENTRY'
        description = `Devasa hacim artışı (${volRatio.toFixed(1)}x) + alım baskısı`
      } else if (mfm < -0.2) {
        type = 'EXIT'
        description = `Devasa hacim artışı (${volRatio.toFixed(1)}x) + satış baskısı`
      } else {
        type = priceChange > 0 ? 'ENTRY' : 'EXIT'
        description = `Devasa hacim artışı (${volRatio.toFixed(1)}x) — belirsiz yön`
      }
    } else if (volRatio >= STEALTH_RATIO && priceRange < STEALTH_RANGE) {
      isWhaleBar = true
      strength = Math.min(85, 40 + volRatio * 15)
      if (mfm > 0) {
        type = 'ENTRY'
        description = `Gizli birikim: yüksek hacim (${volRatio.toFixed(1)}x), dar fiyat aralığı`
      } else {
        type = 'EXIT'
        description = `Gizli dağıtım: yüksek hacim (${volRatio.toFixed(1)}x), dar fiyat aralığı`
      }
    } else if (volRatio >= STRONG_RATIO && Math.abs(mfm) > STRONG_MFM) {
      isWhaleBar = true
      strength = Math.min(80, 35 + volRatio * 12)
      if (mfm > STRONG_MFM) {
        type = 'ENTRY'
        description = isIntraday
          ? `Güçlü alım: hacim ${volRatio.toFixed(1)}x, mumun tepesinde kapanış`
          : `Güçlü alım: hacim ${volRatio.toFixed(1)}x, gün yükseklerinde kapanış`
      } else {
        type = 'EXIT'
        description = isIntraday
          ? `Güçlü satış: hacim ${volRatio.toFixed(1)}x, mumun dibinde kapanış`
          : `Güçlü satış: hacim ${volRatio.toFixed(1)}x, gün düşüklerinde kapanış`
      }
    }

    if (isWhaleBar) {
      events.push({
        date: bar.date,
        type,
        strength: Math.round(strength),
        price: bar.close,
        volume: bar.volume,
        volumeRatio: +volRatio.toFixed(1),
        description,
      })
    }

    if (i >= len - ACC_WINDOW) {
      if (volRatio > ACC_RATIO && mfm > ACC_MFM) accumulationDays++
      if (volRatio > ACC_RATIO && mfm < -ACC_MFM) distributionDays++
    }
  }

  const lastVol = volumes.slice(-LOOKBACK)
  const avgVolume20 = lastVol.reduce((a, b) => a + b, 0) / LOOKBACK
  const currentVolume = volumes[len - 1]
  const volumeRatio = avgVolume20 > 0 ? currentVolume / avgVolume20 : 1

  const halfRecent = Math.floor(RECENT_WINDOW / 2)
  const recentEvents = events.filter(e => {
    const idx = ohlcv.findIndex(b => b.date === e.date)
    return idx >= len - RECENT_WINDOW
  })

  let score = 0

  const recentStrength = recentEvents.reduce((s, e) => s + e.strength, 0)
  score += Math.min(30, recentStrength / (isIntraday ? 5 : 3))

  const vol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
  const vol10 = volumes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5
  if (vol10 > 0 && vol5 / vol10 > 1.3) score += 20
  else if (vol10 > 0 && vol5 / vol10 > 1.1) score += 10

  score += accumulationDays * (isIntraday ? 2 : 3)
  score -= distributionDays * (isIntraday ? 1.5 : 2)

  if (volumeRatio > 2) score += 20
  else if (volumeRatio > 1.5) score += 10
  else if (volumeRatio > 1.2) score += 5

  score = Math.max(0, Math.min(100, Math.round(score)))

  const level = score >= 60 ? 'YÜKSEK' : score >= 30 ? 'ORTA' : 'DÜŞÜK'

  const olderEvents = events.filter(e => {
    const idx = ohlcv.findIndex(b => b.date === e.date)
    return idx >= len - RECENT_WINDOW * 2 && idx < len - RECENT_WINDOW
  })
  const trend = recentEvents.length > olderEvents.length + 1 ? 'ARTIYOR' :
    recentEvents.length < olderEvents.length - 1 ? 'AZALIYOR' : 'STABIL'

  const netWhaleFlow = Math.max(-100, Math.min(100, (accumulationDays - distributionDays) * (isIntraday ? 8 : 12)))

  let recentActivity = ''
  const recentLabel = isIntraday ? `Son ${RECENT_WINDOW} mumda` : `Son ${RECENT_WINDOW} günde`
  if (recentEvents.length === 0) {
    recentActivity = `${recentLabel} belirgin balina aktivitesi yok.`
  } else {
    const entries = recentEvents.filter(e => e.type === 'ENTRY').length
    const exits = recentEvents.filter(e => e.type === 'EXIT').length
    if (entries > exits) {
      recentActivity = `${recentLabel} ${entries} balina girişi tespit edildi. Birikim sinyali.`
    } else if (exits > entries) {
      recentActivity = `${recentLabel} ${exits} balina çıkışı tespit edildi. Dağıtım sinyali.`
    } else {
      recentActivity = `${recentLabel} ${entries} giriş, ${exits} çıkış. Karışık sinyal.`
    }
  }

  return {
    symbol,
    whaleScore: { score, level, trend },
    events: events.slice(isIntraday ? -20 : -30),
    recentActivity,
    avgVolume20,
    currentVolume,
    volumeRatio: +volumeRatio.toFixed(1),
    accumulationDays,
    distributionDays,
    netWhaleFlow,
  }
}
