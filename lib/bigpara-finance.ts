// Bigpara (Hürriyet) API - Alternative BIST data source
// Free, no API key required, 15-min delayed data

export interface BigparaQuote {
  currentPrice: number
  previousClose: number
  dayHigh: number
  dayLow: number
  volume: number
}

// In-memory cache
const bigparaCache: Map<string, { data: BigparaQuote; timestamp: number }> = new Map()
const BIGPARA_CACHE_TTL = 30000 // 30 seconds

let bigparaBulkCache: { data: Map<string, BigparaQuote>; timestamp: number } | null = null
const BIGPARA_BULK_TTL = 60000 // 60 seconds
let bigparaBulkFetchPromise: Promise<Map<string, BigparaQuote>> | null = null

/**
 * Fetch a single stock quote from Bigpara API.
 * Uses the hisseyuzeysel endpoint.
 */
export async function fetchBigparaQuote(symbol: string): Promise<BigparaQuote | null> {
  try {
    const cached = bigparaCache.get(symbol)
    if (cached && Date.now() - cached.timestamp < BIGPARA_CACHE_TTL) {
      return cached.data
    }

    // Also check bulk cache
    if (bigparaBulkCache && Date.now() - bigparaBulkCache.timestamp < BIGPARA_BULK_TTL) {
      const bulkData = bigparaBulkCache.data.get(symbol)
      if (bulkData) return bulkData
    }

    // Bigpara uses clean symbol (no .IS suffix)
    const cleanSymbol = symbol.replace('.IS', '')
    const url = `https://bigpara.hurriyet.com.tr/api/v1/borsa/hisseyuzeysel/${encodeURIComponent(cleanSymbol)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://bigpara.hurriyet.com.tr/',
      },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })

    if (!res.ok) return null

    const data = await res.json()
    const quote = parseBigparaResponse(data)
    if (quote) {
      bigparaCache.set(symbol, { data: quote, timestamp: Date.now() })
    }
    return quote
  } catch (error) {
    console.error(`Bigpara fetch error for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch all BIST stock quotes in bulk from Bigpara.
 * Returns a Map of symbol -> BigparaQuote.
 */
export async function fetchBigparaBulkQuotes(): Promise<Map<string, BigparaQuote>> {
  // Return bulk cache if fresh
  if (bigparaBulkCache && Date.now() - bigparaBulkCache.timestamp < BIGPARA_BULK_TTL) {
    return bigparaBulkCache.data
  }

  if (bigparaBulkFetchPromise) {
    try {
      return await bigparaBulkFetchPromise
    } catch {
      // If ongoing fetch failed, proceed with new one
    }
  }

  bigparaBulkFetchPromise = _doBigparaBulkFetch()
  try {
    const result = await bigparaBulkFetchPromise
    return result
  } finally {
    bigparaBulkFetchPromise = null
  }
}

async function _doBigparaBulkFetch(): Promise<Map<string, BigparaQuote>> {
  const results = new Map<string, BigparaQuote>()

  try {
    const url = 'https://bigpara.hurriyet.com.tr/api/v1/hisse/list'
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://bigpara.hurriyet.com.tr/',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })

    if (!res.ok) return results

    const data = await res.json()
    const stocks = data?.data ?? data ?? []

    if (Array.isArray(stocks)) {
      for (const stock of stocks) {
        const quote = parseBigparaListItem(stock)
        if (quote) {
          const sym = (stock?.kod ?? stock?.sembol ?? stock?.SEMBOL ?? '').toUpperCase()
          if (sym) {
            // Store with both raw symbol and .IS suffix
            results.set(sym, quote)
            results.set(`${sym}.IS`, quote)
            bigparaCache.set(sym, { data: quote, timestamp: Date.now() })
            bigparaCache.set(`${sym}.IS`, { data: quote, timestamp: Date.now() })
          }
        }
      }
    }
  } catch (error) {
    console.error('Bigpara bulk fetch error:', error)
  }

  bigparaBulkCache = { data: results, timestamp: Date.now() }
  return results
}

function parseBigparaResponse(data: any): BigparaQuote | null {
  try {
    const item = data?.data ?? data?.hpilesayfa ?? data
    if (!item) return null

    const currentPrice = parseFloat(item?.alis ?? item?.son ?? item?.kapanis ?? '0')
    if (!currentPrice || currentPrice === 0) return null

    return {
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      previousClose: parseFloat((parseFloat(item?.oncpikapanis ?? item?.dunkukapanis ?? '0') || currentPrice).toFixed(2)),
      dayHigh: parseFloat((parseFloat(item?.yuksek ?? item?.gunyuksek ?? '0') || currentPrice).toFixed(2)),
      dayLow: parseFloat((parseFloat(item?.dusuk ?? item?.gundusuk ?? '0') || currentPrice).toFixed(2)),
      volume: parseInt(item?.hacimlot ?? item?.hacimtl ?? '0') || 0,
    }
  } catch {
    return null
  }
}

function parseBigparaListItem(item: any): BigparaQuote | null {
  try {
    const currentPrice = parseFloat(item?.alis ?? item?.son ?? item?.kapanis ?? item?.KAPANIS ?? '0')
    if (!currentPrice || currentPrice === 0) return null

    return {
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      previousClose: parseFloat((parseFloat(item?.oncpikapanis ?? item?.dunkukapanis ?? item?.ONCEKI_KAPANIS ?? '0') || currentPrice).toFixed(2)),
      dayHigh: parseFloat((parseFloat(item?.yuksek ?? item?.gunyuksek ?? item?.YUKSEK ?? '0') || currentPrice).toFixed(2)),
      dayLow: parseFloat((parseFloat(item?.dusuk ?? item?.gundusuk ?? item?.DUSUK ?? '0') || currentPrice).toFixed(2)),
      volume: parseInt(item?.hacimlot ?? item?.hacimtl ?? item?.HACIM ?? '0') || 0,
    }
  } catch {
    return null
  }
}

// ───── Bigpara Geçmiş Veri (Chart API) ─────

// Sembol → Bigpara ID eşleştirmesi (cache)
let symbolIdMap: Map<string, number> | null = null
let symbolIdMapTimestamp = 0
const SYMBOL_ID_MAP_TTL = 3600000 // 1 saat

async function getSymbolIdMap(): Promise<Map<string, number>> {
  if (symbolIdMap && Date.now() - symbolIdMapTimestamp < SYMBOL_ID_MAP_TTL) {
    return symbolIdMap
  }

  try {
    const res = await fetch('https://bigpara.hurriyet.com.tr/api/v1/hisse/list', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://bigpara.hurriyet.com.tr/',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (!res.ok) return symbolIdMap ?? new Map()

    const json = await res.json()
    const data = json?.data ?? json ?? []
    const map = new Map<string, number>()

    if (Array.isArray(data)) {
      for (const item of data) {
        const kod = (item?.kod ?? '').toUpperCase()
        const id = item?.id
        if (kod && id) {
          map.set(kod, id)
          map.set(`${kod}.IS`, id)
        }
      }
    }

    symbolIdMap = map
    symbolIdMapTimestamp = Date.now()
    return map
  } catch (error) {
    console.error('Bigpara symbol ID map error:', error)
    return symbolIdMap ?? new Map()
  }
}

/**
 * Bigpara chart API periyot eşleştirmesi:
 * 1: Günlük (5dk intraday), 2: ~7 gün, 4: ~1 ay, 5: ~3 ay, 8: ~1 yıl, 9: ~3 yıl, 10: Tümü
 */
function periodToBigparaChart(period: string): number {
  switch (period) {
    case '1D': return 1  // Günlük intraday (5dk)
    case '1W': return 2  // ~7 gün
    case '1M': return 4  // ~1 ay
    case '3M': return 5  // ~3 ay
    case '1Y': return 8  // ~1 yıl
    case '5Y': return 9  // ~3+ yıl
    default: return 4
  }
}

export interface BigparaHistoryPoint {
  timestamp: Date
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Bigpara chart API'den geçmiş fiyat verisi çek.
 * Endpoint: /api/v1/chart/sembol/{sembolId}/{period}
 */
export async function fetchBigparaHistory(
  symbol: string,
  period: string
): Promise<BigparaHistoryPoint[]> {
  try {
    const cleanSymbol = symbol.replace('.IS', '').toUpperCase()
    const idMap = await getSymbolIdMap()
    const sembolId = idMap.get(cleanSymbol)

    if (!sembolId) {
      console.warn(`Bigpara: ${cleanSymbol} için sembol ID bulunamadı`)
      return []
    }

    const chartPeriod = periodToBigparaChart(period)
    const url = `https://bigpara.hurriyet.com.tr/api/v1/chart/sembol/${sembolId}/${chartPeriod}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://bigpara.hurriyet.com.tr/',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (!res.ok) {
      console.warn(`Bigpara chart HTTP ${res.status} for ${cleanSymbol}`)
      return []
    }

    const json = await res.json()
    const data = json?.data ?? []

    if (!Array.isArray(data) || data.length === 0) return []

    const history: BigparaHistoryPoint[] = []

    for (const item of data) {
      const close = parseFloat(item?.kapanis ?? '0')
      if (!close || close <= 0) continue

      history.push({
        timestamp: new Date(item.tarih),
        open: parseFloat(item?.acilis ?? close),
        high: parseFloat(item?.yuksek ?? close),
        low: parseFloat(item?.dusuk ?? close),
        close,
        volume: parseInt(item?.hacimlot ?? '0') || 0,
      })
    }

    return history
  } catch (error) {
    console.error(`Bigpara history error for ${symbol}:`, error)
    return []
  }
}
