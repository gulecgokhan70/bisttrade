// İş Yatırım API - Accurate BIST historical data source
// Free, no API key required, end-of-day data
// Best for: 1M, 3M, 1Y historical charts

export interface IsyatirimQuote {
  symbol: string
  date: string
  close: number
  open: number
  high: number
  low: number
  volume: number
  averagePrice: number
  marketCap: number
  dollarPrice: number
}

// In-memory cache for historical data
const historyCache: Map<string, { data: IsyatirimQuote[]; timestamp: number }> = new Map()
const HISTORY_CACHE_TTL = 300000 // 5 minutes

/**
 * Fetch historical stock data from İş Yatırım.
 * Returns daily OHLCV data for BIST stocks.
 * Source: isyatirim.com.tr
 */
export async function fetchIsyatirimHistory(
  symbol: string,
  period: string
): Promise<Array<{ timestamp: Date; open: number; high: number; low: number; close: number; volume: number }>> {
  try {
    const cacheKey = `${symbol}-${period}`
    const cached = historyCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_TTL) {
      // Re-derive open and volume from cached raw quotes
      const sortedCached = cached.data
        .map(q => ({
          timestamp: parseIsyatirimDate(q.date),
          close: q.close,
          high: q.high,
          low: q.low,
          averagePrice: q.averagePrice,
          volumeTL: q.volume,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      return sortedCached.map((q, idx) => ({
        timestamp: q.timestamp,
        open: idx > 0 ? sortedCached[idx - 1].close : q.close,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.averagePrice > 0 ? Math.round(q.volumeTL / q.averagePrice) : 0,
      }))
    }

    // Clean symbol (remove .IS suffix)
    const cleanSymbol = symbol.replace('.IS', '')

    // Calculate date range based on period
    const endDate = new Date()
    const startDate = new Date()
    switch (period) {
      case '1D': startDate.setDate(endDate.getDate() - 3); break // Get last few days
      case '1W': startDate.setDate(endDate.getDate() - 10); break
      case '1M': startDate.setMonth(endDate.getMonth() - 1); break
      case '3M': startDate.setMonth(endDate.getMonth() - 3); break
      case '1Y': startDate.setFullYear(endDate.getFullYear() - 1); break
      case '5Y': startDate.setFullYear(endDate.getFullYear() - 5); break
      default: startDate.setMonth(endDate.getMonth() - 1)
    }

    const formatDate = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${day}-${month}-${year}`
    }

    const url = `https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?hisse=${encodeURIComponent(cleanSymbol)}&startdate=${formatDate(startDate)}&enddate=${formatDate(endDate)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.isyatirim.com.tr/',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })

    if (!res.ok) return []

    const data = await res.json()
    if (!data?.ok || !Array.isArray(data?.value)) return []

    const quotes: IsyatirimQuote[] = data.value.map((item: any) => ({
      symbol: item.HGDG_HS_KODU ?? cleanSymbol,
      date: item.HGDG_TARIH ?? '',
      close: parseFloat(item.HGDG_KAPANIS ?? item.HG_KAPANIS ?? '0'),
      open: 0, // İş Yatırım doesn't provide open - will be derived from previous close
      high: parseFloat(item.HGDG_MAX ?? item.HG_MAX ?? '0'),
      low: parseFloat(item.HGDG_MIN ?? item.HG_MIN ?? '0'),
      volume: parseFloat(item.HGDG_HACIM ?? item.HG_HACIM ?? '0'), // Note: this is TL volume
      averagePrice: parseFloat(item.HGDG_AOF ?? item.HG_AOF ?? '0'),
      marketCap: parseFloat(item.PD ?? '0'),
      dollarPrice: parseFloat(item.DOLAR_BAZLI_FIYAT ?? '0'),
    }))

    // Cache the results
    historyCache.set(cacheKey, { data: quotes, timestamp: Date.now() })

    // Sort by date first
    const sorted = quotes
      .map(q => ({
        timestamp: parseIsyatirimDate(q.date),
        close: q.close,
        high: q.high,
        low: q.low,
        averagePrice: q.averagePrice,
        volumeTL: q.volume,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    // Derive open from previous day's close (standard practice for EOD data)
    // Convert volume from TL to estimated shares (volumeTL / averagePrice)
    return sorted.map((q, idx) => ({
      timestamp: q.timestamp,
      open: idx > 0 ? sorted[idx - 1].close : q.close, // First day uses own close as fallback
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.averagePrice > 0 ? Math.round(q.volumeTL / q.averagePrice) : 0, // Convert TL volume to shares
    }))
  } catch (error) {
    console.error(`İş Yatırım history error for ${symbol}:`, error)
    return []
  }
}

/**
 * Fetch single stock quote from İş Yatırım (EOD data).
 * Good for getting accurate previous close and daily stats.
 */
export async function fetchIsyatirimQuote(
  symbol: string
): Promise<{ close: number; high: number; low: number; volume: number; marketCap: number } | null> {
  try {
    const cleanSymbol = symbol.replace('.IS', '')
    const today = new Date()
    const formatDate = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      return `${day}-${month}-${year}`
    }

    const url = `https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?hisse=${encodeURIComponent(cleanSymbol)}&startdate=${formatDate(today)}&enddate=${formatDate(today)}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.isyatirim.com.tr/',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data?.ok || !Array.isArray(data?.value) || data.value.length === 0) return null

    const item = data.value[data.value.length - 1] // Latest entry
    return {
      close: parseFloat(item.HGDG_KAPANIS ?? '0'),
      high: parseFloat(item.HGDG_MAX ?? '0'),
      low: parseFloat(item.HGDG_MIN ?? '0'),
      volume: parseFloat(item.HGDG_HACIM ?? '0'),
      marketCap: parseFloat(item.PD ?? '0'),
    }
  } catch (error) {
    console.error(`İş Yatırım quote error for ${symbol}:`, error)
    return null
  }
}

/**
 * Parse İş Yatırım date format (DD-MM-YYYY) to Date object
 */
function parseIsyatirimDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  const parts = dateStr.split('-')
  if (parts.length !== 3) return new Date()
  const [day, month, year] = parts
  // Create date at noon Istanbul time to avoid timezone issues
  return new Date(`${year}-${month}-${day}T12:00:00+03:00`)
}
