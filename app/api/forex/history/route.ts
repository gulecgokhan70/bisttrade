export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

const PERIOD_MAP: Record<string, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1M': { range: '1mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1wk' },
}

const OZ_TO_GRAM = 31.1035
const CEYREK_GRAM = 1.75

interface HistoryPoint {
  date: string
  close: number
}

async function fetchChartData(symbol: string, periodConfig: { range: string; interval: string }): Promise<{ timestamps: number[]; closes: number[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${periodConfig.interval}&range=${periodConfig.range}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) return { timestamps: [], closes: [] }

  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) return { timestamps: [], closes: [] }

  return {
    timestamps: result.timestamp ?? [],
    closes: result.indicators?.quote?.[0]?.close ?? [],
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pair = searchParams.get('pair') ?? 'USDTRY=X'
  const period = searchParams.get('period') ?? '1D'
  const periodConfig = PERIOD_MAP[period] ?? PERIOD_MAP['1D']

  try {
    // Gram and Çeyrek Altın need both GC=F and USDTRY=X
    if (pair === 'GRAM_ALTIN' || pair === 'CEYREK_ALTIN') {
      const multiplier = pair === 'CEYREK_ALTIN' ? CEYREK_GRAM : 1

      const [goldData, usdData] = await Promise.all([
        fetchChartData('GC=F', periodConfig),
        fetchChartData('USDTRY=X', periodConfig),
      ])

      if (goldData.timestamps.length === 0 || usdData.timestamps.length === 0) {
        return Response.json({ history: [] })
      }

      // Build USD/TRY map by rounded timestamp
      const usdMap = new Map<number, number>()
      for (let i = 0; i < usdData.timestamps.length; i++) {
        if (usdData.closes[i] != null) {
          const roundedTs = Math.round(usdData.timestamps[i] / 300) * 300
          usdMap.set(roundedTs, usdData.closes[i])
        }
      }

      let latestUsd = 0
      for (let i = usdData.closes.length - 1; i >= 0; i--) {
        if (usdData.closes[i] != null) { latestUsd = usdData.closes[i]; break }
      }

      const history: HistoryPoint[] = []
      for (let i = 0; i < goldData.timestamps.length; i++) {
        if (goldData.closes[i] != null) {
          const roundedTs = Math.round(goldData.timestamps[i] / 300) * 300
          const usdRate = usdMap.get(roundedTs) ?? latestUsd
          if (usdRate > 0) {
            const val = (goldData.closes[i] / OZ_TO_GRAM) * multiplier * usdRate
            history.push({
              date: new Date(goldData.timestamps[i] * 1000).toISOString(),
              close: val,
            })
          }
        }
      }

      return Response.json({ history })
    }

    // Standard pairs
    const chartData = await fetchChartData(pair, periodConfig)
    const history: HistoryPoint[] = []
    for (let i = 0; i < chartData.timestamps.length; i++) {
      if (chartData.closes[i] != null) {
        history.push({
          date: new Date(chartData.timestamps[i] * 1000).toISOString(),
          close: chartData.closes[i],
        })
      }
    }

    return Response.json({ history })
  } catch (err) {
    console.error('Forex history error:', err)
    return Response.json({ history: [] })
  }
}
