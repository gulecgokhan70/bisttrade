// Yahoo Finance API for BIST stocks
// BIST stocks use .IS suffix on Yahoo Finance
// Uses multiple endpoints with fallback for SSL compatibility

export interface YahooQuote {
  currentPrice: number
  previousClose: number
  dayHigh: number
  dayLow: number
  volume: number
  marketCap?: number
}

// In-memory cache for individual quotes
const priceCache: Map<string, { data: YahooQuote; timestamp: number }> = new Map()
const CACHE_TTL = 30_000 // 30 seconds for individual

// Bulk cache for all stocks
let bulkCache: { data: Map<string, YahooQuote>; timestamp: number } | null = null
const BULK_CACHE_TTL = 60_000 // 60 seconds for bulk — Yahoo rate limit koruması

// Track ongoing bulk fetch to prevent duplicate requests
let bulkFetchPromise: Promise<Map<string, YahooQuote>> | null = null

// Multiple Yahoo Finance endpoints for fallback
const YAHOO_ENDPOINTS = [
  'https://query1.finance.yahoo.com/v8/finance/chart',
  'https://query2.finance.yahoo.com/v8/finance/chart',
]

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
}

// Robust fetch with endpoint fallback
async function yahooFetch(path: string, timeoutMs: number = 5000): Promise<any | null> {
  for (const endpoint of YAHOO_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}${path}`, {
        headers: YAHOO_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
      if (!res.ok) continue
      return await res.json()
    } catch (err: any) {
      // If SSL error, try next endpoint
      if (err?.cause?.code === 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE' ||
          err?.message?.includes('SSL') || err?.message?.includes('fetch failed')) {
        continue
      }
      // For timeout/abort, try next
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') continue
      continue
    }
  }
  return null
}

export async function fetchYahooQuote(yahooSymbol: string): Promise<YahooQuote | null> {
  try {
    // Check individual cache
    const cached = priceCache.get(yahooSymbol)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data
    }

    // Check bulk cache
    if (bulkCache && Date.now() - bulkCache.timestamp < BULK_CACHE_TTL) {
      const bulkData = bulkCache.data.get(yahooSymbol)
      if (bulkData) return bulkData
    }

    const data = await yahooFetch(`/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`, 5000)
    if (!data) return null

    const quote = parseChartResponse(data)
    if (quote) {
      priceCache.set(yahooSymbol, { data: quote, timestamp: Date.now() })
    }
    return quote
  } catch (error) {
    console.error(`Yahoo Finance fetch error for ${yahooSymbol}:`, error)
    return null
  }
}

/**
 * Fetch quotes for multiple symbols in parallel batches.
 * Returns a Map of yahooSymbol -> YahooQuote.
 * Uses aggressive caching to minimize API calls.
 */
export async function fetchYahooBulkQuotes(yahooSymbols: string[]): Promise<Map<string, YahooQuote>> {
  // Return bulk cache if fresh
  if (bulkCache && Date.now() - bulkCache.timestamp < BULK_CACHE_TTL) {
    return bulkCache.data
  }

  // If a bulk fetch is already in progress, wait for it
  if (bulkFetchPromise) {
    try {
      return await bulkFetchPromise
    } catch {
      // If the ongoing fetch failed, proceed with a new one
    }
  }

  // Start new bulk fetch
  bulkFetchPromise = _doBulkFetch(yahooSymbols)
  try {
    const result = await bulkFetchPromise
    return result
  } finally {
    bulkFetchPromise = null
  }
}

async function _doBulkFetch(yahooSymbols: string[]): Promise<Map<string, YahooQuote>> {
  const results = new Map<string, YahooQuote>()
  const BATCH_SIZE = 15
  const MAX_BATCHES = 50 // max 750 stocks

  // First, populate from individual cache
  const uncached: string[] = []
  for (const sym of yahooSymbols) {
    const cached = priceCache.get(sym)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.set(sym, cached.data)
    } else {
      uncached.push(sym)
    }
  }

  // Fetch uncached symbols in parallel batches of 10
  let batchCount = 0
  for (let i = 0; i < uncached.length && batchCount < MAX_BATCHES; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE)
    batchCount++

    const batchResults = await Promise.allSettled(
      batch.map(async (sym) => {
        try {
          const data = await yahooFetch(`/${encodeURIComponent(sym)}?interval=1d&range=1d`)
          if (!data) return { sym, quote: null }
          return { sym, quote: parseChartResponse(data) }
        } catch {
          return { sym, quote: null }
        }
      })
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value.quote) {
        results.set(result.value.sym, result.value.quote)
        priceCache.set(result.value.sym, { data: result.value.quote, timestamp: Date.now() })
      }
    }
  }

  // Update bulk cache
  bulkCache = { data: results, timestamp: Date.now() }
  return results
}

function parseChartResponse(data: any): YahooQuote | null {
  try {
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const meta = result.meta
    if (!meta?.regularMarketPrice || meta.regularMarketPrice === 0) return null

    return {
      currentPrice: parseFloat((meta.regularMarketPrice).toFixed(2)),
      previousClose: parseFloat((meta.previousClose ?? meta.regularMarketPreviousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice).toFixed(2)),
      dayHigh: parseFloat((meta.regularMarketDayHigh ?? meta.regularMarketPrice).toFixed(2)),
      dayLow: parseFloat((meta.regularMarketDayLow ?? meta.regularMarketPrice).toFixed(2)),
      volume: meta.regularMarketVolume ?? 0,
    }
  } catch {
    return null
  }
}

export async function fetchYahooHistory(
  yahooSymbol: string,
  period: string
): Promise<Array<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }>> {
  try {
    let range = '1mo'
    let interval = '1d'
    switch (period) {
      case '1D': range = '1d'; interval = '5m'; break
      case '1W': range = '5d'; interval = '15m'; break
      case '1M': range = '1mo'; interval = '1d'; break
      case '3M': range = '3mo'; interval = '1d'; break
      case '1Y': range = '1y'; interval = '1wk'; break
      case '5Y': range = '5y'; interval = '1mo'; break
    }

    const data = await yahooFetch(`/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`)
    if (!data) return []

    const result = data?.chart?.result?.[0]
    if (!result) return []

    const timestamps = result.timestamp ?? []
    const quotes = result.indicators?.quote?.[0] ?? {}
    const history: Array<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }> = []

    // Get today's date string in Istanbul timezone for filtering
    const nowIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) // YYYY-MM-DD

    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close?.[i]
      if (close == null) continue
      const ts = new Date(timestamps[i] * 1000)

      // Filter intraday data to BIST market hours (10:00-18:10 Istanbul time)
      if (period === '1D' || period === '1W') {
        const istDateStr = ts.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) // YYYY-MM-DD
        const istHour = parseInt(ts.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' }))
        const istMin = parseInt(ts.toLocaleString('en-US', { minute: '2-digit', timeZone: 'Europe/Istanbul' }))
        const istTime = istHour * 60 + istMin
        // BIST: 09:55 - 18:10 (595 - 1090 minutes)
        if (istTime < 595 || istTime > 1090) continue
        // For 1D: only show today's data
        if (period === '1D' && istDateStr !== nowIst) continue
      }

      history.push({
        timestamp: ts,
        open: parseFloat((quotes.open?.[i] ?? close).toFixed(2)),
        high: parseFloat((quotes.high?.[i] ?? close).toFixed(2)),
        low: parseFloat((quotes.low?.[i] ?? close).toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: quotes.volume?.[i] ?? 0,
      })
    }

    // If 1D returns no data for today (e.g. market hasn't opened yet), return last trading day
    if (period === '1D' && history.length === 0) {
      for (let i = 0; i < timestamps.length; i++) {
        const close = quotes.close?.[i]
        if (close == null) continue
        const ts = new Date(timestamps[i] * 1000)
        const istHour = parseInt(ts.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' }))
        const istMin = parseInt(ts.toLocaleString('en-US', { minute: '2-digit', timeZone: 'Europe/Istanbul' }))
        const istTime = istHour * 60 + istMin
        if (istTime < 600 || istTime > 1090) continue
        history.push({
          timestamp: ts,
          open: parseFloat((quotes.open?.[i] ?? close).toFixed(2)),
          high: parseFloat((quotes.high?.[i] ?? close).toFixed(2)),
          low: parseFloat((quotes.low?.[i] ?? close).toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: quotes.volume?.[i] ?? 0,
        })
      }
    }

    return history
  } catch (error) {
    console.error(`Yahoo Finance history error for ${yahooSymbol}:`, error)
    return []
  }
}
