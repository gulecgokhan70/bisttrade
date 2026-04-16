// Yahoo-first finance data provider
// Yahoo Finance is the single source of truth for all price data.
// Bigpara is ONLY used as a last-resort fallback for stocks missing from Yahoo.

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
 * Priority: Yahoo Finance → Bigpara (only if Yahoo fails) → null
 */
export async function fetchMultiSourceQuote(
  yahooSymbol: string,
  symbol: string
): Promise<StockQuote | null> {
  // Try Yahoo first (primary and only source)
  try {
    const yahooQuote = await fetchYahooQuote(yahooSymbol)
    if (yahooQuote && yahooQuote.currentPrice > 0) {
      return { ...yahooQuote, source: 'yahoo' }
    }
  } catch {}

  // Fallback to Bigpara ONLY if Yahoo returned nothing
  try {
    const bigparaQuote = await fetchBigparaQuote(symbol)
    if (bigparaQuote && bigparaQuote.currentPrice > 0) {
      return { ...bigparaQuote, source: 'bigpara' }
    }
  } catch {}

  return null
}

/**
 * Fetch bulk quotes - Yahoo as single source.
 * Bigpara fills in ONLY stocks that Yahoo couldn't provide.
 */
export async function fetchMultiSourceBulkQuotes(
  yahooSymbols: string[]
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>()

  // Step 1: Fetch all from Yahoo (primary source)
  let yahooData = new Map<string, YahooQuote>()
  try {
    yahooData = await fetchYahooBulkQuotes(yahooSymbols)
  } catch {}

  for (const [sym, quote] of yahooData) {
    if (quote && quote.currentPrice > 0) {
      results.set(sym, { ...quote, source: 'yahoo' })
    }
  }

  // Step 2: Only fetch Bigpara if there are gaps
  const missing = yahooSymbols.filter(s => !results.has(s))
  if (missing.length > 0) {
    try {
      const bigparaData = await fetchBigparaBulkQuotes()
      for (const sym of missing) {
        const bpQuote = bigparaData.get(sym) ?? bigparaData.get(sym.replace('.IS', ''))
        if (bpQuote && bpQuote.currentPrice > 0) {
          results.set(sym, { ...bpQuote, source: 'bigpara' })
        }
      }
    } catch {}
  }

  return results
}