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
