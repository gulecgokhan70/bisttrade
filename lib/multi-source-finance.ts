// Multi-source finance data provider
// Priority: CollectAPI → Yahoo Finance → Bigpara (3 kademeli fallback)

import { fetchCollectApiQuote, fetchCollectApiBulkQuotes } from './collectapi-finance'
import { fetchYahooQuote, fetchYahooBulkQuotes, type YahooQuote } from './yahoo-finance'
import { fetchBigparaQuote, fetchBigparaBulkQuotes, type BigparaQuote } from './bigpara-finance'

export interface StockQuote {
  currentPrice: number
  previousClose: number
  dayHigh: number
  dayLow: number
  volume: number
  marketCap?: number
  source: 'collectapi' | 'yahoo' | 'bigpara' | 'db'
}

/**
 * Fetch a single stock quote.
 * Priority: CollectAPI → Yahoo Finance → Bigpara → null
 */
export async function fetchMultiSourceQuote(
  yahooSymbol: string,
  symbol: string
): Promise<StockQuote | null> {
  // 1) CollectAPI (birincil kaynak)
  try {
    const collectQuote = await fetchCollectApiQuote(yahooSymbol)
    if (collectQuote && collectQuote.currentPrice > 0) {
      return { ...collectQuote, source: 'collectapi' }
    }
  } catch {}

  // 2) Yahoo Finance (ikincil kaynak)
  try {
    const yahooQuote = await fetchYahooQuote(yahooSymbol)
    if (yahooQuote && yahooQuote.currentPrice > 0) {
      return { ...yahooQuote, source: 'yahoo' }
    }
  } catch {}

  // 3) Bigpara (üçüncü kaynak)
  try {
    const bigparaQuote = await fetchBigparaQuote(symbol)
    if (bigparaQuote && bigparaQuote.currentPrice > 0) {
      return { ...bigparaQuote, source: 'bigpara' }
    }
  } catch {}

  return null
}

/**
 * Fetch bulk quotes - 3 kademeli fallback.
 * CollectAPI → Yahoo → Bigpara
 */
export async function fetchMultiSourceBulkQuotes(
  yahooSymbols: string[]
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>()

  // Step 1: CollectAPI (birincil — toplu çekim, tek API call)
  try {
    const collectData = await fetchCollectApiBulkQuotes()
    for (const sym of yahooSymbols) {
      const cQuote = collectData.get(sym) ?? collectData.get(sym.replace('.IS', ''))
      if (cQuote && cQuote.currentPrice > 0) {
        results.set(sym, { ...cQuote, source: 'collectapi' })
      }
    }
  } catch {}

  // Step 2: Yahoo Finance (ikincil — eksik hisseler için toplu çekim)
  const missingAfterCollect = yahooSymbols.filter(s => !results.has(s))
  if (missingAfterCollect.length > 0) {
    try {
      const yahooData = await fetchYahooBulkQuotes(missingAfterCollect)
      for (const [sym, quote] of yahooData) {
        if (quote && quote.currentPrice > 0) {
          results.set(sym, { ...quote, source: 'yahoo' })
        }
      }
    } catch {}
  }

  // Step 3: Bigpara (üçüncü — hâlâ eksik olanlar için toplu çekim)
  const missingAfterYahoo = yahooSymbols.filter(s => !results.has(s))
  if (missingAfterYahoo.length > 0) {
    try {
      const bigparaData = await fetchBigparaBulkQuotes()
      for (const sym of missingAfterYahoo) {
        const bpQuote = bigparaData.get(sym) ?? bigparaData.get(sym.replace('.IS', ''))
        if (bpQuote && bpQuote.currentPrice > 0) {
          results.set(sym, { ...bpQuote, source: 'bigpara' })
        }
      }
    } catch {}
  }

  return results
}