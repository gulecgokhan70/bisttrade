// Multi-source finance data provider
// Priority: Yahoo Finance → Bigpara → İş Yatırım (3 kademeli fallback)

import { fetchYahooQuote, fetchYahooBulkQuotes, type YahooQuote } from './yahoo-finance'
import { fetchBigparaQuote, fetchBigparaBulkQuotes, type BigparaQuote } from './bigpara-finance'
import { fetchIsyatirimQuote } from './isyatirim-finance'

export interface StockQuote {
  currentPrice: number
  previousClose: number
  dayHigh: number
  dayLow: number
  volume: number
  marketCap?: number
  source: 'yahoo' | 'bigpara' | 'isyatirim' | 'db'
}

/**
 * Fetch a single stock quote.
 * Priority: Yahoo Finance → Bigpara → İş Yatırım → null
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

  // 3) İş Yatırım (üçüncü kaynak — EOD verisi)
  try {
    const isyQuote = await fetchIsyatirimQuote(yahooSymbol)
    if (isyQuote && isyQuote.close > 0) {
      return {
        currentPrice: isyQuote.close,
        previousClose: isyQuote.close, // EOD — kapanış fiyatı
        dayHigh: isyQuote.high,
        dayLow: isyQuote.low,
        volume: isyQuote.volume,
        marketCap: isyQuote.marketCap > 0 ? isyQuote.marketCap : undefined,
        source: 'isyatirim',
      }
    }
  } catch {}

  return null
}

/**
 * Fetch bulk quotes - 3 kademeli fallback.
 * Yahoo → Bigpara → İş Yatırım (eksik hisseler için tek tek)
 */
export async function fetchMultiSourceBulkQuotes(
  yahooSymbols: string[]
): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>()

  // Step 1: Yahoo Finance (birincil — toplu çekim)
  let yahooData = new Map<string, YahooQuote>()
  try {
    yahooData = await fetchYahooBulkQuotes(yahooSymbols)
  } catch {}

  for (const [sym, quote] of yahooData) {
    if (quote && quote.currentPrice > 0) {
      results.set(sym, { ...quote, source: 'yahoo' })
    }
  }

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

  // Step 3: İş Yatırım (üçüncü — hâlâ eksik olanlar için tek tek çekim)
  const missingAfterBigpara = yahooSymbols.filter(s => !results.has(s))
  if (missingAfterBigpara.length > 0) {
    // Paralel çekim — en fazla 10 tane aynı anda
    const batchSize = 10
    for (let i = 0; i < missingAfterBigpara.length; i += batchSize) {
      const batch = missingAfterBigpara.slice(i, i + batchSize)
      const promises = batch.map(async (sym) => {
        try {
          const isyQuote = await fetchIsyatirimQuote(sym)
          if (isyQuote && isyQuote.close > 0) {
            results.set(sym, {
              currentPrice: isyQuote.close,
              previousClose: isyQuote.close,
              dayHigh: isyQuote.high,
              dayLow: isyQuote.low,
              volume: isyQuote.volume,
              marketCap: isyQuote.marketCap > 0 ? isyQuote.marketCap : undefined,
              source: 'isyatirim',
            })
          }
        } catch {}
      })
      await Promise.all(promises)
    }
  }

  return results
}