export const dynamic = 'force-dynamic'

interface ForexRate {
  pair: string
  label: string
  rate: number
  change: number
  changePercent: number
  unit?: string
}

// Fetch: USD/TRY, EUR/TRY, Gold ounce (USD), BIST 100
const FETCH_PAIRS = [
  { pair: 'USDTRY=X', label: 'USD/TRY' },
  { pair: 'EURTRY=X', label: 'EUR/TRY' },
  { pair: 'GC=F', label: 'Altın Ons', hidden: true },
  { pair: 'XU100.IS', label: 'BİST 100' },
]

let cachedData: ForexRate[] | null = null
let cacheTime = 0
const CACHE_TTL = 60_000

const OZ_TO_GRAM = 31.1035
const CEYREK_GRAM = 1.75 // Çeyrek altın yaklaşık 1.75 gram

async function fetchQuoteData(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  // Try v7 quote first
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      const q = data?.quoteResponse?.result?.[0]
      if (q?.regularMarketPrice) {
        return {
          price: q.regularMarketPrice,
          change: q.regularMarketChange ?? 0,
          changePercent: q.regularMarketChangePercent ?? 0,
        }
      }
    }
  } catch {}

  // Fallback to chart API
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json()
      const meta = data?.chart?.result?.[0]?.meta
      if (meta?.regularMarketPrice) {
        const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice
        const change = meta.regularMarketPrice - prev
        const changePct = prev > 0 ? (change / prev) * 100 : 0
        return { price: meta.regularMarketPrice, change, changePercent: changePct }
      }
    }
  } catch {}

  return null
}

async function fetchForexData(): Promise<ForexRate[]> {
  const now = Date.now()
  if (cachedData && now - cacheTime < CACHE_TTL) {
    return cachedData
  }

  // Fetch all pairs in parallel
  const rawMap: Record<string, { price: number; change: number; changePercent: number }> = {}

  // Try bulk first
  try {
    const symbols = FETCH_PAIRS.map(p => p.pair).join(',')
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      for (const q of (data?.quoteResponse?.result ?? [])) {
        if (q?.symbol && q.regularMarketPrice) {
          rawMap[q.symbol] = {
            price: q.regularMarketPrice,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
          }
        }
      }
    }
  } catch {}

  // Fallback individually for missing
  const missing = FETCH_PAIRS.filter(p => !rawMap[p.pair])
  await Promise.all(missing.map(async (fp) => {
    const d = await fetchQuoteData(fp.pair)
    if (d) rawMap[fp.pair] = d
  }))

  const results: ForexRate[] = []
  const usdtry = rawMap['USDTRY=X']
  const eurtry = rawMap['EURTRY=X']
  const goldOz = rawMap['GC=F']
  const bist = rawMap['XU100.IS']

  // USD/TRY
  if (usdtry) {
    results.push({ pair: 'USDTRY=X', label: 'USD/TRY', rate: usdtry.price, change: usdtry.change, changePercent: usdtry.changePercent })
  }

  // EUR/TRY
  if (eurtry) {
    results.push({ pair: 'EURTRY=X', label: 'EUR/TRY', rate: eurtry.price, change: eurtry.change, changePercent: eurtry.changePercent })
  }

  // Gram Altın (TRY)
  if (goldOz && usdtry) {
    const gramTRY = (goldOz.price / OZ_TO_GRAM) * usdtry.price
    const prevGold = goldOz.price - goldOz.change
    const prevUsd = usdtry.price - usdtry.change
    const prevGram = (prevGold > 0 && prevUsd > 0) ? (prevGold / OZ_TO_GRAM) * prevUsd : gramTRY
    const gramChange = gramTRY - prevGram
    const gramPct = prevGram > 0 ? (gramChange / prevGram) * 100 : 0
    results.push({ pair: 'GRAM_ALTIN', label: 'Gram Altın', rate: gramTRY, change: gramChange, changePercent: gramPct, unit: '₺' })
  }

  // Çeyrek Altın (TRY)
  if (goldOz && usdtry) {
    const ceyrekTRY = (goldOz.price / OZ_TO_GRAM) * CEYREK_GRAM * usdtry.price
    const prevGold = goldOz.price - goldOz.change
    const prevUsd = usdtry.price - usdtry.change
    const prevCeyrek = (prevGold > 0 && prevUsd > 0) ? (prevGold / OZ_TO_GRAM) * CEYREK_GRAM * prevUsd : ceyrekTRY
    const ceyrekChange = ceyrekTRY - prevCeyrek
    const ceyrekPct = prevCeyrek > 0 ? (ceyrekChange / prevCeyrek) * 100 : 0
    results.push({ pair: 'CEYREK_ALTIN', label: 'Çeyrek Altın', rate: ceyrekTRY, change: ceyrekChange, changePercent: ceyrekPct, unit: '₺' })
  }

  // BİST 100
  if (bist) {
    results.push({ pair: 'XU100.IS', label: 'BİST 100', rate: bist.price, change: bist.change, changePercent: bist.changePercent })
  }

  if (results.length > 0) {
    cachedData = results
    cacheTime = now
  }

  return results
}

export async function GET() {
  try {
    const data = await fetchForexData()
    return Response.json(data)
  } catch (err: any) {
    console.error('Forex API error:', err)
    return Response.json([], { status: 200 })
  }
}
