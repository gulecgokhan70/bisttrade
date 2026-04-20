// Multi-source finance data provider
// Priority: Yahoo Finance → Bigpara (2 kademeli fallback)

import { fetchYahooQuote, fetchYahooBulkQuotes, type YahooQuote } from './yahoo-finance'
import { fetchBigparaQuote, fetchBigparaBulkQuotes, type BigparaQuote } from './bigpara-finance'

export interface StockQuote {
  currentPrice: number
  previousClose: number
  dayHigh: number
  dayLow: number
  volume: number
  marketCap?: number
  source: 'yahoo' | 'bigpara' | 'db'
}

/**
 * Fetch a single stock quote.
 * Priority: Yahoo Finance → Bigpara → null
 */
export async function fetchMultiSourceQuote(
  yahooSymbol: string,
  symbol: string
): Promise<StockQuote | null> {
  // 1) Yahoo Finance (birincil kaynak)
  try {
    const yahooQuote = await fetchYahooQuote(yahooSymbol)
    if (yahooQuote && yahooQuote.currentPrice > 0) {
      return { ...yahooQuote, source: 'yahoo' }
    }
  } catch {}

  // 2) Bigpara (ikincil kaynak)
  try {
    const bigparaQuote = await fetchBigparaQuote(symbol)
    if (bigparaQuote && bigparaQuote.currentPrice > 0) {
      return { ...bigparaQuote, source: 'bigpara' }
    }
  } catch {}

  return null
}

/**
 * Fetch bulk quotes - 2 kademeli fallback.
 * Yahoo → Bigpara
 */
export async function fetchMultiSourceBulkQuotes(
  yahooSymbols: string[]
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>()

  // Step 1: Yahoo Finance (birincil — toplu çekim)
  try {
    const yahooData = await fetchYahooBulkQuotes(yahooSymbols)
    for (const [sym, quote] of yahooData) {
      if (quote && quote.currentPrice > 0) {
        results.set(sym, { ...quote, source: 'yahoo' })
      }
    }
  } catch {}

  // Step 2: Bigpara (ikincil — eksik hisseler için toplu çekim)
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