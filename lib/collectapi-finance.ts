// CollectAPI — BIST hisse verileri (birincil kaynak)
// Endpoint: https://api.collectapi.com/economy/hisseSenedi
// Auth: apikey header
// Veri: Tüm BIST hisseleri — fiyat, hacim, değişim oranı

export interface CollectApiQuote {
  currentPrice: number
  previousClose: number
  dayHigh: number
  dayLow: number
  volume: number
  marketCap?: number
}

// In-memory cache — CollectAPI ücretsiz plan rate limit'i düşük, agresif cache
let bulkCache: { data: Map<string, CollectApiQuote>; timestamp: number } | null = null
const BULK_CACHE_TTL = 60000 // 60 saniye (rate limit koruması)
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 10000 // İstekler arası minimum 10 saniye

/**
 * CollectAPI'den tüm BIST hisselerini çek.
 * Response format:
 * { success: true, result: [{ code, lastprice, rate, hacim, text, ... }] }
 */
export async function fetchCollectApiBulkQuotes(): Promise<Map<string, CollectApiQuote>> {
  // Cache kontrolü
  if (bulkCache && Date.now() - bulkCache.timestamp < BULK_CACHE_TTL) {
    return bulkCache.data
  }

  // Rate limit koruması — art arda istek gönderme
  const now = Date.now()
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    return bulkCache?.data ?? new Map()
  }
  lastRequestTime = now

  const apiKey = process.env.COLLECTAPI_KEY
  if (!apiKey) {
    console.warn('CollectAPI: COLLECTAPI_KEY bulunamadı')
    return new Map()
  }

  try {
    const res = await fetch('https://api.collectapi.com/economy/hisseSenedi', {
      headers: {
        'content-type': 'application/json',
        'authorization': `apikey ${apiKey}`,
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })

    if (!res.ok) {
      if (res.status === 429) {
        // Rate limit — sessizce cache'den dön, fallback kaynaklara geç
        return bulkCache?.data ?? new Map()
      }
      console.warn(`CollectAPI HTTP ${res.status}`)
      return bulkCache?.data ?? new Map()
    }

    const json = await res.json()
    if (!json?.success || !Array.isArray(json?.result)) {
      console.error('CollectAPI: Geçersiz response format')
      return bulkCache?.data ?? new Map()
    }

    const results = new Map<string, CollectApiQuote>()

    for (const item of json.result) {
      const code = (item.code ?? '').trim().toUpperCase()
      if (!code) continue

      const lastPrice = parseFloat(item.lastprice ?? '0')
      const rate = parseFloat(item.rate ?? '0') // Yüzdesel değişim
      const volume = parseFloat(item.hacim ?? '0') // TL cinsinden hacim
      const min = parseFloat(item.min ?? '0')
      const max = parseFloat(item.max ?? '0')

      if (lastPrice <= 0) continue

      // Önceki kapanışı yüzdesel değişimden hesapla
      // rate = ((lastPrice - prevClose) / prevClose) * 100
      // prevClose = lastPrice / (1 + rate/100)
      const previousClose = rate !== 0
        ? lastPrice / (1 + rate / 100)
        : lastPrice

      const quote: CollectApiQuote = {
        currentPrice: lastPrice,
        previousClose: Math.round(previousClose * 100) / 100,
        dayHigh: max > 0 ? max : lastPrice,
        dayLow: min > 0 ? min : lastPrice,
        volume: volume,
      }

      // Hem düz kod hem de .IS suffix'li olarak kaydet
      results.set(code, quote)
      results.set(`${code}.IS`, quote)
    }

    // Cache güncelle
    bulkCache = { data: results, timestamp: Date.now() }
    console.log(`CollectAPI: ${results.size / 2} hisse çekildi`)

    return results
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      console.error('CollectAPI: Timeout')
    } else {
      console.error('CollectAPI error:', error?.message ?? error)
    }
    return bulkCache?.data ?? new Map()
  }
}

/**
 * Tek hisse fiyatı çek (bulk cache'den).
 */
export async function fetchCollectApiQuote(
  symbol: string
): Promise<CollectApiQuote | null> {
  const data = await fetchCollectApiBulkQuotes()
  return data.get(symbol) ?? data.get(symbol.replace('.IS', '')) ?? null
}
